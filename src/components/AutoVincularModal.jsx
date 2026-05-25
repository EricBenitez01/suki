import { useState, useMemo } from 'react'
import { updateProducto } from '../lib/db.js'
import { fmtARS } from '../lib/calculations.js'

// ─── Fuzzy matching ───────────────────────────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Words too common to use for matching
const STOPWORDS = new Set(['de','del','la','el','los','las','para','con','sin','por','en','un','una','y','o','a'])

function tokenize(str) {
  return normalize(str).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function matchScore(productName, mlTitle) {
  const wp = tokenize(productName)
  const wm = tokenize(mlTitle)
  if (!wp.length || !wm.length) return 0
  const setP = new Set(wp)
  const hits = wm.filter(w => setP.has(w)).length
  // Bonus: check if product name is fully contained in ML title (common case)
  const normP = normalize(productName)
  const normM = normalize(mlTitle)
  const containsBonus = normM.includes(normP) || normP.includes(normM.substring(0, Math.min(normM.length, 20))) ? 0.2 : 0
  return Math.min(1, hits / Math.max(wp.length, wm.length) + containsBonus)
}

export function computeSuggestions(productos, mlItems) {
  // Only consider unlinked products
  const unlinked = productos.filter(p => !p.mlItemId)
  // Only consider ML items not already linked
  const linkedMlIds = new Set(productos.filter(p => p.mlItemId).map(p => p.mlItemId))
  const availableML = mlItems.filter(m => !linkedMlIds.has(m.id))

  const suggestions = []
  for (const prod of unlinked) {
    let best = null, bestScore = 0
    for (const ml of availableML) {
      const score = matchScore(prod.nombre, ml.title)
      if (score > bestScore) { bestScore = score; best = ml }
    }
    if (best && bestScore >= 0.25) {
      suggestions.push({ producto: prod, mlItem: best, score: bestScore, confirmed: bestScore >= 0.5 })
    }
  }
  // Sort by score desc
  return suggestions.sort((a, b) => b.score - a.score)
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function AutoVincularModal({ productos, mlItems, onClose, onDone }) {
  const raw = useMemo(() => computeSuggestions(productos, mlItems), [productos, mlItems])
  const [pairs, setPairs] = useState(() => raw.map(s => ({ ...s, selected: s.confirmed })))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selectedCount = pairs.filter(p => p.selected).length

  const updatePairML = (idx, mlId) => {
    const ml = mlItems.find(m => m.id === mlId)
    setPairs(prev => prev.map((p, i) => i === idx ? { ...p, mlItem: ml, selected: !!ml } : p))
  }

  const handleSave = async () => {
    setSaving(true)
    const toSave = pairs.filter(p => p.selected && p.mlItem)
    for (const pair of toSave) {
      await updateProducto(pair.producto.id, { mlItemId: pair.mlItem.id })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { onDone(toSave.length); onClose() }, 800)
  }

  // All ML items not already linked, for the override dropdowns
  const linkedMlIds = new Set(productos.filter(p => p.mlItemId).map(p => p.mlItemId))
  const availableML = mlItems.filter(m => !linkedMlIds.has(m.id))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: 720, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--line)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                Auto-vincular publicaciones ML
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4 }}>
                {pairs.length === 0
                  ? 'No se encontraron coincidencias automáticas.'
                  : `Encontramos ${pairs.length} coincidencia${pairs.length !== 1 ? 's' : ''} — revisá y confirmá.`}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-mute)', padding: '0 4px' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          {pairs.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <p>Todos los productos ya están vinculados, o los nombres son demasiado distintos para matchear automáticamente.</p>
              <p style={{ marginTop: 8 }}>Vinculá manualmente desde el detalle de cada producto en el Catálogo.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-alt)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-mute)', width: 32 }}></th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Producto catálogo</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Publicación ML sugerida</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-mute)', width: 70 }}>Match</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair, idx) => (
                  <tr key={pair.producto.id} style={{ borderBottom: '1px solid var(--line)', background: pair.selected ? 'var(--pos-bg)' : undefined }}>
                    {/* Checkbox */}
                    <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={pair.selected}
                        onChange={e => setPairs(prev => prev.map((p, i) => i === idx ? { ...p, selected: e.target.checked } : p))}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>
                    {/* Producto catálogo */}
                    <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{pair.producto.nombre}</div>
                      {pair.producto.sku && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{pair.producto.sku}</div>}
                      {pair.producto.costoUnitARS && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Costo: {fmtARS(pair.producto.costoUnitARS)}</div>}
                    </td>
                    {/* ML item */}
                    <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {pair.mlItem?.thumbnail && (
                          <img
                            src={pair.mlItem.thumbnail.replace('http://', 'https://')}
                            alt=""
                            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: '#fff', border: '1px solid var(--line)', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}
                            title={pair.mlItem?.title}>
                            {pair.mlItem?.title?.substring(0, 55)}{pair.mlItem?.title?.length > 55 ? '…' : ''}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                            {pair.mlItem ? `${fmtARS(pair.mlItem.price)} · Stock: ${pair.mlItem.available_quantity}` : '—'}
                          </div>
                        </div>
                      </div>
                      {/* Override dropdown */}
                      <select
                        className="form-input"
                        style={{ fontSize: 11, padding: '3px 6px', width: '100%' }}
                        value={pair.mlItem?.id || ''}
                        onChange={e => updatePairML(idx, e.target.value)}
                      >
                        <option value="">— No vincular —</option>
                        {availableML.map(m => (
                          <option key={m.id} value={m.id}>{m.title.substring(0, 60)}</option>
                        ))}
                        {/* Also keep current if it's not in availableML */}
                        {pair.mlItem && !availableML.find(m => m.id === pair.mlItem.id) && (
                          <option value={pair.mlItem.id}>{pair.mlItem.title.substring(0, 60)}</option>
                        )}
                      </select>
                    </td>
                    {/* Score */}
                    <td style={{ padding: '10px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: pair.score >= 0.6 ? 'var(--pos-bg)' : pair.score >= 0.4 ? 'var(--warn-bg)' : 'var(--bg-alt)',
                        color: pair.score >= 0.6 ? 'var(--pos)' : pair.score >= 0.4 ? 'var(--warn)' : 'var(--ink-mute)',
                      }}>
                        {Math.round(pair.score * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>
            {selectedCount} vínculo{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
            {pairs.length > 0 && (
              <button
                style={{ marginLeft: 10, fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setPairs(prev => prev.map(p => ({ ...p, selected: true })))}
              >
                Seleccionar todo
              </button>
            )}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sm" onClick={onClose}>Cancelar</button>
            {pairs.length > 0 && (
              <button
                className="btn-sm primary"
                onClick={handleSave}
                disabled={saving || selectedCount === 0 || saved}
              >
                {saved ? '✓ Guardado' : saving ? 'Guardando…' : `Vincular ${selectedCount} producto${selectedCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
