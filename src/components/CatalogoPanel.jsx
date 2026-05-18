import { useState, useEffect } from 'react'
import { loadProductos, addProducto, updateProducto, deleteProducto, loadSimulaciones } from '../lib/db.js'
import { calcPricing, calcularComparativa, DEFAULTS, fmtARS, fmtUSD, fmt } from '../lib/calculations.js'

const ESCENARIOS = [10, 15, 20, 25, 30, 35]

function loadImportaciones() {
  try { return JSON.parse(localStorage.getItem('suki_importaciones')) || [] } catch { return [] }
}

function SourceBadge({ source }) {
  const map = {
    manual:     { icon: '💾', label: 'Manual',      cls: 'manual' },
    simulacion: { icon: '⚖️', label: 'Cotizador',   cls: 'simulacion' },
    importacion:{ icon: '📦', label: 'Importación', cls: 'importacion' },
  }
  const { icon, label, cls } = map[source] || map.manual
  return <span className={`source-badge ${cls}`}>{icon} {label}</span>
}

function calcMargenPct(p) {
  if (!p.precioActual || !p.costoUnitARS) return null
  const fn = 1 - (p.mlPct||0)/100 - (p.adsPct||0)/100 - (p.ivaPct||0)/100 - (p.iibbPct||0)/100 - (p.otrosPct||0)/100
  return ((p.precioActual * fn - p.costoUnitARS) / p.precioActual * 100)
}

function calcImportProductoCosto(importacion, productoId, fleteMode) {
  const prod = importacion.productos.find(p => p.id === parseInt(productoId))
  if (!prod) return null
  const tc = parseFloat(importacion.form.tc) || DEFAULTS.tc
  const inputs = {
    ...DEFAULTS,
    fob: parseFloat(prod.fobUnit) * parseFloat(prod.unidades),
    unidades: parseFloat(prod.unidades),
    pesoKg: parseFloat(prod.pesoKg),
    largoCm: '', anchoCm: '', altoCm: '', bultos: '',
    di: parseFloat(prod.di),
    tc,
    fleteAereoModo: 'calculado',
    fleteAereoCotizacion: '',
  }
  const result = calcularComparativa(inputs)
  return result ? result[fleteMode] : null
}

// ── ResultBox ──────────────────────────────────────────────────────────────────
function ResultBox({ label, result, isPromo }) {
  const ok = result.margenUnitario >= 0
  return (
    <div style={{
      border: `2px solid ${ok ? 'var(--pos)' : 'var(--neg)'}`,
      borderRadius: 8, padding: '12px 14px',
      background: ok ? 'var(--pos-bg)' : 'var(--neg-bg)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Precio</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>{fmtARS(result.precio)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Margen / ud</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: ok ? 'var(--pos)' : 'var(--neg)' }}>
            {fmtARS(result.margenUnitario)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>% sobre precio</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>{fmt(result.margenSobrePrecio * 100, 1)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Neto unitario</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-soft)' }}>{fmtARS(result.netoUnitario)}</div>
        </div>
      </div>
    </div>
  )
}

// ── NuevoProductoForm ──────────────────────────────────────────────────────────
function NuevoProductoForm({ onSave, onCancel }) {
  const [nombre, setNombre] = useState('')
  const [sku, setSku] = useState('')
  const [costoSource, setCostoSource] = useState('manual')
  const [costoARS, setCostoARS] = useState('')
  const [costoUSD, setCostoUSD] = useState('')
  const [mlPct, setMlPct] = useState(25)
  const [adsPct, setAdsPct] = useState(12)
  const [ivaPct, setIvaPct] = useState(14)
  const [iibbPct, setIibbPct] = useState(0)
  const [precioActual, setPrecioActual] = useState('')
  const [simId, setSimId] = useState('')
  const [simMode, setSimMode] = useState('maritimo')
  const [importId, setImportId] = useState('')
  const [importProdId, setImportProdId] = useState('')
  const [importMode, setImportMode] = useState('maritimo')
  const [importCosto, setImportCosto] = useState(null)

  const simulaciones = loadSimulaciones()
  const importaciones = loadImportaciones()
  const selectedImport = importaciones.find(i => i.id === parseInt(importId))

  useEffect(() => {
    if (costoSource !== 'importacion' || !importId || !importProdId || !selectedImport) {
      setImportCosto(null); return
    }
    setImportCosto(calcImportProductoCosto(selectedImport, importProdId, importMode))
  }, [costoSource, importId, importProdId, importMode, selectedImport])

  const handleSave = () => {
    if (!nombre.trim()) return
    let finalCostoARS = costoARS ? parseFloat(costoARS) : null
    let finalCostoUSD = costoUSD ? parseFloat(costoUSD) : null
    let finalSimId = null, finalImportId = null, finalImportProdId = null

    if (costoSource === 'simulacion' && simId) {
      const sim = simulaciones.find(s => s.id === parseInt(simId))
      if (sim) {
        const d = simMode === 'aereo' ? sim.aereo : sim.maritimo
        finalCostoARS = d.costoUnitARS
        finalCostoUSD = d.costoUnitUSD
        finalSimId = sim.id
      }
    } else if (costoSource === 'importacion' && importId && importProdId && importCosto) {
      finalCostoARS = importCosto.costoUnitARS
      finalCostoUSD = importCosto.costoUnitUSD
      finalImportId = parseInt(importId)
      finalImportProdId = parseInt(importProdId)
    }

    onSave({
      nombre: nombre.trim(), sku: sku.trim(),
      mlPct, adsPct, ivaPct, iibbPct, otrosPct: 0,
      precioActual: precioActual ? parseFloat(precioActual) : null,
      costoUnitARS: finalCostoARS, costoUnitUSD: finalCostoUSD,
      costoSource,
      simulacionId: finalSimId,
      importacionId: finalImportId,
      importacionProductoId: finalImportProdId,
    })
  }

  return (
    <div className="card">
      <div className="card-header">Nuevo producto</div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre <span>*</span></label>
            <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Auriculares JBL" autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">SKU <span>(opcional)</span></label>
            <input className="form-input" value={sku} onChange={e => setSku(e.target.value)}
              placeholder="Ej: AUR-JBL-01" />
          </div>
        </div>

        <div>
          <label className="form-label">Origen del costo</label>
          <div className="pill-toggle" style={{ marginBottom: 0 }}>
            <button className={costoSource === 'manual' ? 'active' : ''} onClick={() => setCostoSource('manual')}>💾 Manual</button>
            <button className={costoSource === 'simulacion' ? 'active' : ''} onClick={() => setCostoSource('simulacion')}>⚖️ Cotizador</button>
            <button className={costoSource === 'importacion' ? 'active' : ''} onClick={() => setCostoSource('importacion')}>📦 Importación</button>
          </div>
        </div>

        {costoSource === 'manual' && (
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Costo unit. <span>ARS *</span></label>
              <input className="form-input mono" type="number" min="0" value={costoARS}
                onChange={e => setCostoARS(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Costo unit. <span>USD</span></label>
              <input className="form-input mono" type="number" min="0" value={costoUSD}
                onChange={e => setCostoUSD(e.target.value)} placeholder="0" />
            </div>
          </div>
        )}

        {costoSource === 'simulacion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Simulación</label>
                <select className="form-input" value={simId} onChange={e => setSimId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {simulaciones.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} — {new Date(s.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Modo</label>
                <div className="pill-toggle" style={{ marginBottom: 0 }}>
                  <button className={simMode === 'maritimo' ? 'active' : ''} onClick={() => setSimMode('maritimo')}>🚢 Mar.</button>
                  <button className={simMode === 'aereo' ? 'active' : ''} onClick={() => setSimMode('aereo')}>✈ Aéreo</button>
                </div>
              </div>
            </div>
            {simId && (() => {
              const sim = simulaciones.find(s => s.id === parseInt(simId))
              const d = sim ? (simMode === 'aereo' ? sim.aereo : sim.maritimo) : null
              return d ? (
                <p className="form-hint">
                  Costo unitario: <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtARS(d.costoUnitARS)}</strong>
                  {d.costoUnitUSD ? ` · ${fmtUSD(d.costoUnitUSD)}` : ''}
                </p>
              ) : null
            })()}
          </div>
        )}

        {costoSource === 'importacion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Importación</label>
                <select className="form-input" value={importId} onChange={e => { setImportId(e.target.value); setImportProdId('') }}>
                  <option value="">Seleccionar...</option>
                  {importaciones.map(i => (
                    <option key={i.id} value={i.id}>{i.form.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Producto</label>
                <select className="form-input" value={importProdId}
                  onChange={e => setImportProdId(e.target.value)} disabled={!selectedImport}>
                  <option value="">Seleccionar...</option>
                  {(selectedImport?.productos || []).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Modo de flete</label>
              <div className="pill-toggle" style={{ marginBottom: 0 }}>
                <button className={importMode === 'maritimo' ? 'active' : ''} onClick={() => setImportMode('maritimo')}>🚢 Marítimo</button>
                <button className={importMode === 'aereo' ? 'active' : ''} onClick={() => setImportMode('aereo')}>✈ Aéreo</button>
              </div>
            </div>
            {importCosto && (
              <p className="form-hint">
                Costo unitario: <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtARS(importCosto.costoUnitARS)}</strong>
                {' · '}{fmtUSD(importCosto.costoUnitUSD)}
              </p>
            )}
          </div>
        )}

        <div>
          <div className="form-section">Parámetros de Pricing ML</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: '%ML', val: mlPct, set: setMlPct },
              { label: '%Ads', val: adsPct, set: setAdsPct },
              { label: '%IVA', val: ivaPct, set: setIvaPct },
              { label: '%IIBB', val: iibbPct, set: setIibbPct },
            ].map(({ label, val, set }) => (
              <div key={label} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{label}</label>
                <input className="form-input mono" type="number" min="0" max="100" step="0.1"
                  value={val} onChange={e => set(parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Precio actual <span>ARS (opcional)</span></label>
          <input className="form-input mono" type="number" min="0" step="1000"
            value={precioActual} onChange={e => setPrecioActual(e.target.value)} placeholder="Ej: 180000" />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="btn-sm primary" onClick={handleSave} disabled={!nombre.trim()}>
            Guardar producto
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ProductoDetail ─────────────────────────────────────────────────────────────
function ProductoDetail({ producto, onBack, onUpdate, onDelete, onNavigate }) {
  const [mlPct, setMlPct] = useState(producto.mlPct ?? 25)
  const [adsPct, setAdsPct] = useState(producto.adsPct ?? 12)
  const [ivaPct, setIvaPct] = useState(producto.ivaPct ?? 14)
  const [iibbPct, setIibbPct] = useState(producto.iibbPct ?? 0)
  const [otrosPct, setOtrosPct] = useState(producto.otrosPct ?? 0)
  const [precioActual, setPrecioActual] = useState(producto.precioActual ? String(producto.precioActual) : '')
  const [precioPromo, setPrecioPromo] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editNombre, setEditNombre] = useState(producto.nombre)
  const [editSku, setEditSku] = useState(producto.sku || '')
  const [updateFlash, setUpdateFlash] = useState(false)

  const costoARS = producto.costoUnitARS
  const factorNeto = 1 - mlPct/100 - adsPct/100 - ivaPct/100 - iibbPct/100 - otrosPct/100

  const precioNum = parseFloat(precioActual) || null
  const precioResult = costoARS && precioNum ? {
    precio: precioNum,
    netoUnitario: precioNum * factorNeto,
    margenUnitario: precioNum * factorNeto - costoARS,
    margenSobrePrecio: (precioNum * factorNeto - costoARS) / precioNum,
  } : null

  const precioPromoNum = parseFloat(precioPromo) || null
  const promoResult = costoARS && precioPromoNum ? {
    precio: precioPromoNum,
    netoUnitario: precioPromoNum * factorNeto,
    margenUnitario: precioPromoNum * factorNeto - costoARS,
    margenSobrePrecio: (precioPromoNum * factorNeto - costoARS) / precioPromoNum,
  } : null

  const handleSavePricing = () => {
    onUpdate(producto.id, { mlPct, adsPct, ivaPct, iibbPct, otrosPct, precioActual: precioNum || null })
  }

  const handleActualizarCosto = () => {
    if (producto.costoSource === 'simulacion' && producto.simulacionId) {
      const sim = loadSimulaciones().find(s => s.id === producto.simulacionId)
      if (sim) {
        const d = sim.ganador === 'aereo' ? sim.aereo : sim.maritimo
        onUpdate(producto.id, { costoUnitARS: d.costoUnitARS, costoUnitUSD: d.costoUnitUSD })
        flashUpdate()
      }
    } else if (producto.costoSource === 'importacion' && producto.importacionId) {
      const imp = loadImportaciones().find(i => i.id === producto.importacionId)
      if (imp) {
        const fleteMode = imp.form.fleteMode || 'maritimo'
        const costo = calcImportProductoCosto(imp, producto.importacionProductoId, fleteMode)
        if (costo) {
          onUpdate(producto.id, { costoUnitARS: costo.costoUnitARS, costoUnitUSD: costo.costoUnitUSD })
          flashUpdate()
        }
      }
    }
  }

  const flashUpdate = () => {
    setUpdateFlash(true)
    setTimeout(() => setUpdateFlash(false), 2000)
  }

  const vinculoSim = producto.simulacionId
    ? loadSimulaciones().find(s => s.id === producto.simulacionId)
    : null
  const vinculoImp = producto.importacionId
    ? loadImportaciones().find(i => i.id === producto.importacionId)
    : null

  return (
    <div>
      <button className="producto-back-btn" onClick={onBack}>← Volver al catálogo</button>

      <div className="page-header" style={{ marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="form-input" style={{ fontSize: 18, fontWeight: 800, maxWidth: 280 }}
                value={editNombre} onChange={e => setEditNombre(e.target.value)} />
              <input className="form-input" style={{ width: 130 }} value={editSku}
                onChange={e => setEditSku(e.target.value)} placeholder="SKU" />
              <button className="btn-sm primary" onClick={() => { onUpdate(producto.id, { nombre: editNombre, sku: editSku }); setIsEditing(false) }}>
                Guardar
              </button>
              <button className="btn-sm" onClick={() => setIsEditing(false)}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title">{producto.nombre}</h1>
              {producto.sku && (
                <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: 4 }}>
                  {producto.sku}
                </span>
              )}
              <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
                <button className="btn-sm" onClick={() => setIsEditing(true)}>✏️ Editar</button>
                <button className="btn-sm danger" onClick={() => {
                  if (window.confirm('¿Eliminar este producto del catálogo?')) { onDelete(producto.id); onBack() }
                }}>🗑</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Costo base */}
      <div className="card producto-section">
        <div className="card-header">Costo base</div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div className="kpi-label">Costo unit. ARS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                {costoARS ? fmtARS(costoARS) : <span style={{ color: 'var(--ink-mute)', fontSize: 16 }}>Sin costo cargado</span>}
              </div>
            </div>
            {producto.costoUnitUSD && (
              <div>
                <div className="kpi-label">Costo unit. USD</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)' }}>
                  {fmtUSD(producto.costoUnitUSD)}
                </div>
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <SourceBadge source={producto.costoSource} />
              {(producto.simulacionId || producto.importacionId) && (
                <button className="btn-sm" onClick={handleActualizarCosto}>
                  {updateFlash ? '✓ Actualizado' : '↻ Actualizar costo'}
                </button>
              )}
            </div>
          </div>
          {producto.updatedAt && (
            <p className="form-hint" style={{ marginTop: 8 }}>
              Actualizado: {new Date(producto.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Pricing ML */}
      <div className="card producto-section" style={{ marginTop: 16 }}>
        <div className="card-header">Pricing ML</div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '%ML', val: mlPct, set: setMlPct },
              { label: '%Ads', val: adsPct, set: setAdsPct },
              { label: '%IVA', val: ivaPct, set: setIvaPct },
              { label: '%IIBB', val: iibbPct, set: setIibbPct },
              { label: '%Otros', val: otrosPct, set: setOtrosPct },
            ].map(({ label, val, set }) => (
              <div key={label} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{label}</label>
                <input className="form-input mono" type="number" min="0" max="100" step="0.5"
                  value={val} onChange={e => set(parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio actual <span>ARS</span></label>
              <input className="form-input mono" type="number" min="0" step="1000"
                value={precioActual} onChange={e => setPrecioActual(e.target.value)} placeholder="Ej: 180000" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Simular promo <span>ARS</span></label>
              <input className="form-input mono" type="number" min="0" step="1000"
                value={precioPromo} onChange={e => setPrecioPromo(e.target.value)} placeholder="Precio con descuento" />
            </div>
          </div>

          {!costoARS && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-alt)', borderRadius: 6, fontSize: 13, color: 'var(--ink-mute)', marginBottom: 14 }}>
              Sin costo base — completá el costo unitario para activar la simulación.
            </div>
          )}

          {costoARS && (precioResult || promoResult) && (
            <div style={{ display: 'grid', gridTemplateColumns: precioResult && promoResult ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 14 }}>
              {precioResult && <ResultBox label="Precio actual" result={precioResult} />}
              {promoResult && <ResultBox label="Simulación promo" result={promoResult} isPromo />}
            </div>
          )}

          {costoARS && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Escenarios — % margen sobre precio de venta
              </div>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Margen %</th>
                    <th>Precio sugerido</th>
                    <th>Neto unitario</th>
                    <th>Margen ARS</th>
                    <th>% s/ costo</th>
                  </tr>
                </thead>
                <tbody>
                  {ESCENARIOS.map(pct => {
                    const r = calcPricing({ costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, targetMargen: pct, modoTarget: 'precio' })
                    if (!r) return null
                    return (
                      <tr key={pct}>
                        <td>{pct}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--brand)', fontWeight: 600 }}>
                          {fmtARS(Math.ceil(r.precio / 1000) * 1000)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtARS(r.netoUnitario)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, color: r.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {fmtARS(r.margenUnitario)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(r.margenSobreCosto * 100, 1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn-sm primary" onClick={handleSavePricing}>
              Guardar parámetros y precio
            </button>
          </div>
        </div>
      </div>

      {/* Vínculos */}
      {(vinculoSim || vinculoImp) && (
        <div className="card producto-section" style={{ marginTop: 16 }}>
          <div className="card-header">Vínculos</div>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {vinculoSim && (
              <button className="vinculo-card" onClick={() => onNavigate('historial')}>
                <span style={{ fontSize: 22 }}>⚖️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{vinculoSim.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                    {new Date(vinculoSim.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 600 }}>Ver →</span>
              </button>
            )}
            {vinculoImp && (
              <button className="vinculo-card" onClick={() => onNavigate('importaciones')}>
                <span style={{ fontSize: 22 }}>📦</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{vinculoImp.form.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{vinculoImp.form.status}</div>
                </div>
                <span style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 600 }}>Ver →</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CatalogoPanel (main) ───────────────────────────────────────────────────────
export default function CatalogoPanel({ onNavigate }) {
  const [productos, setProductos] = useState([])
  const [importaciones, setImportaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [showNuevo, setShowNuevo] = useState(false)

  useEffect(() => {
    Promise.all([loadProductos(), loadImportaciones()]).then(([prods, imps]) => {
      setProductos(prods)
      setImportaciones(imps)
      setLoading(false)
    })
  }, [])

  const refresh = () => loadProductos().then(setProductos)

  const selectedProducto = selectedId != null ? productos.find(p => p.id === selectedId) : null

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const handleNuevo = async (data) => {
    await addProducto(data)
    await refresh()
    setShowNuevo(false)
  }

  const handleUpdate = async (id, changes) => {
    await updateProducto(id, changes)
    await refresh()
  }

  const handleDelete = async (id) => {
    await deleteProducto(id)
    setSelectedId(null)
    await refresh()
  }

  if (loading) return <div className="empty-state" style={{ marginTop: 60 }}><div className="empty-state-text">Cargando catálogo…</div></div>

  if (selectedProducto) {
    return (
      <ProductoDetail
        producto={selectedProducto}
        onBack={() => setSelectedId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de productos</h1>
          <p className="page-subtitle">Pricing · Costo landed · Vínculos a importaciones y simulaciones</p>
        </div>
      </div>

      <div className="catalogo-toolbar">
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>🔍</span>
          <input
            className="form-input catalogo-search"
            placeholder="Buscar por nombre o SKU..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <button className="btn-sm primary" onClick={() => setShowNuevo(v => !v)}>
          {showNuevo ? '× Cancelar' : '+ Nuevo producto'}
        </button>
      </div>

      {showNuevo && (
        <div style={{ marginTop: 16 }}>
          <NuevoProductoForm onSave={handleNuevo} onCancel={() => setShowNuevo(false)} />
        </div>
      )}

      {filtrados.length === 0 && !showNuevo && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🛍️</div>
              <div className="empty-state-title">
                {busqueda ? 'Sin resultados' : 'Catálogo vacío'}
              </div>
              <div className="empty-state-text">
                {busqueda
                  ? `No se encontraron productos para "${busqueda}".`
                  : 'Agregá productos manualmente, o guárdalos desde el Cotizador o una Importación.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="breakdown-table catalogo-table">
              <thead>
                <tr>
                  <th>Producto / SKU</th>
                  <th>Costo unit. ARS</th>
                  <th>Precio actual</th>
                  <th>Margen %</th>
                  <th>Fuente</th>
                  <th>Importación vinculada</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const margenPct = calcMargenPct(p)
                  const imp = p.importacionId ? importaciones.find(i => i.id === p.importacionId) : null
                  return (
                    <tr key={p.id} className="catalogo-row" onClick={() => setSelectedId(p.id)}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.nombre}</div>
                        {p.sku && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{p.sku}</div>}
                      </td>
                      <td>{p.costoUnitARS ? fmtARS(p.costoUnitARS) : '—'}</td>
                      <td>{p.precioActual ? fmtARS(p.precioActual) : '—'}</td>
                      <td>
                        {margenPct != null
                          ? <span style={{ color: margenPct >= 0 ? 'var(--pos)' : 'var(--neg)', fontWeight: 700 }}>{fmt(margenPct, 1)}%</span>
                          : '—'}
                      </td>
                      <td><SourceBadge source={p.costoSource} /></td>
                      <td>
                        {imp
                          ? <span style={{ fontSize: 12 }}>{imp.form.nombre}</span>
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-mute)' }}>
            {filtrados.length} producto{filtrados.length !== 1 ? 's' : ''}
            {busqueda && productos.length !== filtrados.length && ` de ${productos.length} · filtrando por "${busqueda}"`}
          </div>
        </div>
      )}
    </div>
  )
}
