import { useState } from 'react'
import { fmtUSD } from '../lib/calculations.js'

const CATALOG_DEFAULTS = { sku: '', mlPct: 25, adsPct: 12, ivaPct: 14, iibbPct: 0, modo: 'maritimo' }

export default function SaveModal({ results, defaultTitle, onSave, onClose }) {
  const [titulo, setTitulo] = useState(defaultTitle || '')
  const [notas, setNotas] = useState('')
  const [addToCatalog, setAddToCatalog] = useState(false)
  const [cat, setCat] = useState(CATALOG_DEFAULTS)

  const setC = k => e => setCat(prev => ({ ...prev, [k]: e.target.value }))

  const fecha = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const handleSave = () => {
    onSave({
      titulo: titulo.trim() || defaultTitle || 'Sin título',
      notas,
      catalogo: addToCatalog ? { ...cat, mlPct: +cat.mlPct, adsPct: +cat.adsPct, ivaPct: +cat.ivaPct, iibbPct: +cat.iibbPct } : null,
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">💾 Guardar simulación</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Título <span>*</span></label>
            <input
              className="form-input"
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Auriculares JBL × 50 uds"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {results && (
            <div className="modal-meta">
              <div className="modal-meta-item">
                <span className="modal-meta-label">✈ Aéreo</span>
                <span className="modal-meta-value">{fmtUSD(results.aereo.totalUSD)}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">🚢 Marítimo</span>
                <span className="modal-meta-value">{fmtUSD(results.maritimo.totalUSD)}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Fecha</span>
                <span className="modal-meta-value">{fecha}</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notas <span>(opcional)</span></label>
            <textarea
              className="form-input"
              rows={3}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, proveedor, condiciones especiales…"
              style={{ resize: 'vertical', minHeight: 70 }}
            />
          </div>

          <label className="save-modal-catalog-check">
            <input type="checkbox" checked={addToCatalog} onChange={e => setAddToCatalog(e.target.checked)} />
            <span>➕ Agregar al catálogo de productos</span>
          </label>

          {addToCatalog && (
            <div className="save-modal-catalog-fields">
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">SKU (opcional)</label>
                <input className="form-input" value={cat.sku} onChange={setC('sku')} placeholder="Ej: AUR-JBL-510" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label className="form-label">Comisión ML %</label>
                  <input className="form-input mono" type="number" min="0" max="100" step="0.1" value={cat.mlPct} onChange={setC('mlPct')} />
                </div>
                <div>
                  <label className="form-label">Ads %</label>
                  <input className="form-input mono" type="number" min="0" max="100" step="0.1" value={cat.adsPct} onChange={setC('adsPct')} />
                </div>
                <div>
                  <label className="form-label">IVA %</label>
                  <input className="form-input mono" type="number" min="0" max="100" step="0.1" value={cat.ivaPct} onChange={setC('ivaPct')} />
                </div>
                <div>
                  <label className="form-label">IIBB %</label>
                  <input className="form-input mono" type="number" min="0" max="100" step="0.1" value={cat.iibbPct} onChange={setC('iibbPct')} />
                </div>
              </div>
              <div>
                <label className="form-label">Costo base desde</label>
                <div className="save-modal-modo-btns">
                  <button type="button" className={`btn-sm${cat.modo === 'maritimo' ? ' primary' : ''}`} onClick={() => setCat(p => ({ ...p, modo: 'maritimo' }))}>🚢 Marítimo</button>
                  <button type="button" className={`btn-sm${cat.modo === 'aereo' ? ' primary' : ''}`} onClick={() => setCat(p => ({ ...p, modo: 'aereo' }))}>✈ Aéreo</button>
                </div>
                {results && (
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                    Costo unitario: {cat.modo === 'maritimo'
                      ? `${fmtUSD(results.maritimo.costoUnitUSD)} · ARS ${results.maritimo.costoUnitARS?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                      : `${fmtUSD(results.aereo.costoUnitUSD)} · ARS ${results.aereo.costoUnitARS?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-sm primary" onClick={handleSave}>
            Guardar simulación
          </button>
        </div>
      </div>
    </div>
  )
}
