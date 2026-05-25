import { useState, useRef } from 'react'
import { getCachedItems } from '../lib/meli.js'
import { addProducto } from '../lib/db.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { fmtARS } from '../lib/calculations.js'

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result
}

function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]).map(v => v.trim().replace(/^"|"$/g, ''))
    if (vals.every(v => !v)) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = vals[j] ?? '' })
    rows.push(row)
  }
  return { headers, rows }
}

// ── Number parsing ────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str && str !== 0) return null
  let s = String(str).replace(/[$\s%]/g, '').trim()
  if (!s) return null
  // Argentine format: 1.234.567,89
  if (/\d\.\d{3}/.test(s) && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  // US format: 1,234,567.89
  else if (/\d,\d{3}/.test(s) && s.includes('.')) s = s.replace(/,/g, '')
  // Simple with comma decimal
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parsePct(str) {
  const n = parseNum(str)
  if (n === null) return null
  return n < 1 ? +(n * 100).toFixed(2) : n
}

// ── Column detection ──────────────────────────────────────────────────────────

const COL_ALIASES = {
  sku:      ['sku'],
  nombre:   ['producto', 'nombre', 'product', 'descripcion'],
  costoARS: ['costo unit final ars', 'costo final ars', 'costo ars', 'costounitfinalars', 'costoars'],
  costoUSD: ['costo unit final usd', 'costo final usd', 'costo usd', 'costounitfinalusd'],
  mlPct:    ['%ml_eq', 'ml_eq', '%ml', 'ml eq', 'comision ml'],
  adsPct:   ['%ads_eq', 'ads_eq', '%ads', 'ads eq'],
  ivaPct:   ['%iva_eq', 'iva_eq', '%iva', 'iva eq'],
  iibbPct:  ['%iibb_eq', 'iibb_eq', '%iibb', 'iibb eq'],
  otrosPct: ['%otrosvar_eq', 'otrosvar_eq', '%otros', 'otros_eq'],
}

function detectCols(headers) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9%]/g, '')
  const result = {}
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    result[field] = headers.find(h => aliases.some(a => norm(h) === a || norm(h).includes(a))) ?? null
  }
  return result
}

// ── Name similarity matching ──────────────────────────────────────────────────

function normStr(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function matchScore(a, b) {
  const na = normStr(a), nb = normStr(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = new Set(na.split(' ').filter(w => w.length > 2))
  const wb = new Set(nb.split(' ').filter(w => w.length > 2))
  if (wa.size === 0 || wb.size === 0) return 0
  const inter = [...wa].filter(w => wb.has(w)).length
  return inter / Math.max(wa.size, wb.size)
}

function findMLMatch(sku, nombre, mlItems, existingProducts) {
  // Already in catalog with cost loaded
  if (sku) {
    const ex = existingProducts.find(p =>
      p.sku?.toLowerCase() === sku.toLowerCase() && p.costoUnitARS
    )
    if (ex) return { type: 'exists', product: ex }
  }

  // Match by seller_sku
  if (sku) {
    const bySkuItem = mlItems.find(item => {
      if (item.seller_sku && item.seller_sku.toLowerCase() === sku.toLowerCase()) return true
      const skuAttr = item.attributes?.find(a =>
        a.id === 'SELLER_SKU' || a.name?.toLowerCase().includes('sku')
      )
      return skuAttr?.value_name?.toLowerCase() === sku.toLowerCase()
    })
    if (bySkuItem) {
      const loaded = existingProducts.find(p => p.mlItemId === bySkuItem.id && p.costoUnitARS)
      if (loaded) return { type: 'exists', item: bySkuItem, product: loaded }
      return { type: 'match', item: bySkuItem, score: 1, method: 'SKU' }
    }
  }

  // Match by name
  if (nombre) {
    let best = null, bestScore = 0
    for (const item of mlItems) {
      const s = matchScore(nombre, item.title)
      if (s > bestScore) { bestScore = s; best = item }
    }
    if (best && bestScore >= 0.55) {
      const loaded = existingProducts.find(p => p.mlItemId === best.id && p.costoUnitARS)
      if (loaded) return { type: 'exists', item: best, product: loaded }
      return { type: 'match', item: best, score: bestScore, method: 'nombre' }
    }
    return { type: 'nomatch', score: bestScore, bestItem: best }
  }

  return { type: 'nomatch' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportarCostosModal({ productos, onClose, onDone }) {
  const showToast = useToast()
  const mlItems = getCachedItems()?.items || []
  const [step, setStep] = useState('upload')
  const [cols, setCols] = useState(null)
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows: csvRows } = parseCSV(e.target.result)
      if (!csvRows.length) { showToast('CSV vacío o sin datos', 'error'); return }
      const detected = detectCols(headers)
      setCols(detected)
      const mapped = csvRows.map(row => {
        const sku = detected.sku ? (row[detected.sku] || '').trim() : ''
        const nombre = detected.nombre ? (row[detected.nombre] || '').trim() : ''
        const costoARS = parseNum(detected.costoARS ? row[detected.costoARS] : '')
        const match = findMLMatch(sku, nombre, mlItems, productos)
        return { row, match, costoARS, checked: match.type !== 'exists' && !!costoARS }
      }).filter(r => {
        const nombre = detected.nombre ? (r.row[detected.nombre] || '').trim() : ''
        return nombre || r.costoARS
      })
      setRows(mapped)
      setStep('review')
    }
    reader.onerror = () => showToast('Error al leer el archivo', 'error')
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const toggleRow = (i) => setRows(prev => prev.map((r, j) => j === i ? { ...r, checked: !r.checked } : r))
  const toggleAll = () => {
    const selectables = rows.filter(r => r.match.type !== 'exists' && r.costoARS)
    const allChecked = selectables.every(r => r.checked)
    setRows(prev => prev.map(r => r.match.type === 'exists' || !r.costoARS ? r : { ...r, checked: !allChecked }))
  }

  const handleImport = async () => {
    const toImport = rows.filter(r => r.checked && r.costoARS)
    if (!toImport.length) return
    setSaving(true)
    let count = 0
    for (const { row, match, costoARS } of toImport) {
      try {
        const nombre = (cols.nombre ? row[cols.nombre] : '') || 'Sin nombre'
        const sku = cols.sku ? row[cols.sku] || '' : ''
        const mlItem = match.item || null
        await addProducto({
          nombre: nombre.slice(0, 80).trim(),
          sku: sku.trim(),
          costoUnitARS: costoARS,
          costoUnitUSD: parseNum(cols.costoUSD ? row[cols.costoUSD] : '') || null,
          costoSource: 'manual',
          simulacionId: null,
          importacionId: null,
          importacionProductoId: null,
          mlItemId: mlItem?.id || null,
          mlPct:    parsePct(cols.mlPct    ? row[cols.mlPct]    : '') ?? 25,
          adsPct:   parsePct(cols.adsPct   ? row[cols.adsPct]   : '') ?? 12,
          ivaPct:   parsePct(cols.ivaPct   ? row[cols.ivaPct]   : '') ?? 14,
          iibbPct:  parsePct(cols.iibbPct  ? row[cols.iibbPct]  : '') ?? 0,
          otrosPct: parsePct(cols.otrosPct ? row[cols.otrosPct] : '') ?? 0,
          precioActual: mlItem ? (mlItem.sale_price?.amount ?? mlItem.price ?? null) : null,
        })
        count++
      } catch (err) {
        console.error('Error importando fila:', err)
      }
    }
    setSavedCount(count)
    setSaving(false)
    setStep('done')
    onDone()
  }

  const checkedCount = rows.filter(r => r.checked && r.costoARS).length
  const matchCount   = rows.filter(r => r.match.type === 'match').length
  const existsCount  = rows.filter(r => r.match.type === 'exists').length
  const nomatchCount = rows.filter(r => r.match.type === 'nomatch').length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 820, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {step === 'upload' && '📥 Importar costos desde CSV'}
            {step === 'review' && `📥 Revisar importación — ${rows.length} filas`}
            {step === 'done'   && '✅ Importación completada'}
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  Arrastrá o hacé click para subir el CSV
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
                  Archivo .csv exportado desde Google Sheets o Excel
                </div>
                <input
                  ref={fileRef} type="file" accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>

              <div className="card" style={{ background: 'var(--bg-alt)' }}>
                <div className="card-body" style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>¿Cómo exportar desde Google Sheets?</div>
                  <div>1. Abrí tu planilla de costos</div>
                  <div>2. <strong>Archivo → Descargar → Valores separados por comas (.csv)</strong></div>
                  <div>3. Subí el archivo acá</div>
                  <div style={{ marginTop: 8, color: 'var(--ink-mute)' }}>
                    Columnas detectadas automáticamente: <strong>SKU, Producto, Costo Unit Final ARS,
                    Costo Unit Final USD, %ML_eq, %Ads_eq, %IVA_eq, %IIBB_eq, %OtrosVar_eq</strong>
                  </div>
                </div>
              </div>

              {mlItems.length === 0 && (
                <div style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
                  ⚠️ No hay publicaciones ML sincronizadas — los productos se importarán al catálogo sin vincular a ML.
                  Sincronizá primero para obtener el mejor matching.
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Review ── */}
          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total filas', val: rows.length, color: 'var(--ink)' },
                  { label: 'Match ML', val: matchCount, color: 'var(--pos)' },
                  { label: 'Sin match', val: nomatchCount, color: 'var(--warn)' },
                  { label: 'Ya cargado', val: existsCount, color: 'var(--ink-mute)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: 'var(--radius)', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Column detection info */}
              {cols && !cols.costoARS && (
                <div style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
                  ⚠️ No se detectó la columna de costo ARS. Verificá que el CSV tenga una columna llamada
                  "Costo Unit Final ARS" o similar.
                </div>
              )}

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: 32 }}>
                        <input type="checkbox"
                          checked={checkedCount > 0 && checkedCount === rows.filter(r => r.match.type !== 'exists' && r.costoARS).length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Producto</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>SKU</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Costo ARS</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Vinculación ML</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const nombre = cols?.nombre ? r.row[cols.nombre] : ''
                      const sku    = cols?.sku    ? r.row[cols.sku]    : ''
                      const isExists = r.match.type === 'exists'
                      const isMatch  = r.match.type === 'match'
                      const noMatch  = r.match.type === 'nomatch'
                      const noCosto  = !r.costoARS

                      return (
                        <tr key={i} style={{
                          borderBottom: '1px solid var(--border)',
                          opacity: isExists ? 0.5 : 1,
                          background: r.checked ? 'var(--brand-bg, rgba(79,140,255,.06))' : 'transparent',
                        }}>
                          <td style={{ padding: '7px 8px' }}>
                            <input
                              type="checkbox"
                              checked={r.checked}
                              disabled={isExists || noCosto}
                              onChange={() => toggleRow(i)}
                            />
                          </td>
                          <td style={{ padding: '7px 8px', fontWeight: 600, maxWidth: 200 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {nombre || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', fontSize: 11 }}>
                            {sku || '—'}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {r.costoARS ? fmtARS(r.costoARS) : <span style={{ color: 'var(--neg)' }}>Sin costo</span>}
                          </td>
                          <td style={{ padding: '7px 8px', maxWidth: 220 }}>
                            {isMatch && (
                              <div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--pos)', fontWeight: 600 }}>
                                  {r.match.item.title.length > 40 ? r.match.item.title.slice(0, 40) + '…' : r.match.item.title}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                                  {r.match.item.id} · via {r.match.method}
                                  {r.match.score < 1 && ` (${Math.round(r.match.score * 100)}%)`}
                                </div>
                              </div>
                            )}
                            {noMatch && (
                              <span style={{ color: 'var(--warn)', fontSize: 11 }}>
                                Sin match → se carga sin vincular
                              </span>
                            )}
                            {isExists && (
                              <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
                                Ya tiene costo cargado
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                            {isExists && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-mute)', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: 99 }}>SKIP</span>}
                            {isMatch  && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', background: 'var(--pos-bg)', padding: '2px 8px', borderRadius: 99 }}>✓ MATCH</span>}
                            {noMatch  && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', padding: '2px 8px', borderRadius: 99 }}>SIN MATCH</span>}
                            {noCosto  && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neg)', background: 'var(--neg-bg)', padding: '2px 8px', borderRadius: 99 }}>SIN COSTO</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {nomatchCount > 0 && (
                <div style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--warn)' }}>
                  <strong>{nomatchCount} fila{nomatchCount !== 1 ? 's' : ''} sin match con ML</strong> — se importan al catálogo sin vincular.
                  Podés vincularlos manualmente desde el Catálogo después.
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                <button className="btn-sm" onClick={() => { setStep('upload'); setRows([]); setCols(null) }}>
                  ← Cambiar archivo
                </button>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
                    {checkedCount} producto{checkedCount !== 1 ? 's' : ''} a importar
                  </span>
                  <button
                    className="btn-sm primary"
                    disabled={checkedCount === 0 || saving}
                    onClick={handleImport}
                  >
                    {saving ? '⟳ Importando…' : `✓ Importar ${checkedCount} producto${checkedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">{savedCount} producto{savedCount !== 1 ? 's' : ''} importado{savedCount !== 1 ? 's' : ''}</div>
              <div className="empty-state-text">
                Los costos quedaron cargados en el Catálogo.
                {savedCount > 0 && ' El Dashboard de Salud y el P&L ya pueden usar estos datos.'}
              </div>
              <button className="btn-sm primary" style={{ marginTop: 20 }} onClick={onClose}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
