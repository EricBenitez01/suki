import { useState, useEffect, useMemo, useCallback } from 'react'
import { loadProductos, addProducto, updateProducto, deleteProducto, loadSimulaciones } from '../lib/db.js'
import { calcPricing, calcularComparativa, DEFAULTS, fmtARS, fmtUSD, fmt } from '../lib/calculations.js'
import { getCachedItems, getMeliConnection } from '../lib/meli.js'
import ConfirmModal from './ConfirmModal.jsx'
import PublicarMLModal from './PublicarMLModal.jsx'
import { useToast } from '../contexts/ToastContext.jsx'

const ESCENARIOS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

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


// ── MLItemSelector ────────────────────────────────────────────────────────────
function MLItemSelector({ value, onChange }) {
  const [mlItems] = useState(() => getCachedItems()?.items || [])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query) return mlItems.slice(0, 30)
    const q = query.toLowerCase()
    return mlItems.filter(m => m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)).slice(0, 30)
  }, [mlItems, query])

  const selected = mlItems.find(m => m.id === value)

  if (mlItems.length === 0) {
    return (
      <p className="form-hint" style={{ color: 'var(--warn)' }}>
        Sin publicaciones ML en caché — sincronizá desde ML Publicaciones primero.
      </p>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {selected ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--pos-bg)', border: '1px solid var(--pos)',
          borderRadius: 'var(--radius)', padding: '8px 12px',
        }}>
          {selected.thumbnail && (
            <img src={selected.thumbnail.replace('http://', 'https://')} alt=""
              style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
              {fmtARS(selected.sale_price?.amount ?? selected.price)}
              {selected.sale_price?.amount && selected.sale_price.amount < selected.price && (
                <span style={{ textDecoration: 'line-through', marginLeft: 4, opacity: 0.6 }}>{fmtARS(selected.price)}</span>
              )}
              {' · '}Stock: {selected.available_quantity}
            </div>
          </div>
          <button className="btn-sm" onClick={() => { onChange(null); setQuery('') }}>✕</button>
        </div>
      ) : (
        <div>
          <input
            className="form-input"
            placeholder="Buscar publicación ML por título o ID…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          {open && filtered.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
              maxHeight: 260, overflowY: 'auto', marginTop: 2,
            }}>
              {filtered.map(m => (
                <button
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 12px', background: 'none',
                    border: 'none', borderBottom: '1px solid var(--line)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseDown={() => { onChange(m.id); setQuery(''); setOpen(false) }}
                >
                  {m.thumbnail && (
                    <img src={m.thumbnail.replace('http://', 'https://')} alt=""
                      style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 3, background: '#fff', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                      {fmtARS(m.sale_price?.amount ?? m.price)}
                      {m.sale_price?.amount && m.sale_price.amount < m.price && <span style={{ textDecoration: 'line-through', marginLeft: 4, opacity: 0.6 }}>{fmtARS(m.price)}</span>}
                      {' · '}Stock: {m.available_quantity}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── NuevoProductoForm ──────────────────────────────────────────────────────────
function NuevoProductoForm({ onSave, onCancel, existingProductos = [] }) {
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
  const [mlItemId, setMlItemId] = useState(null)
  const [simId, setSimId] = useState('')
  const [simMode, setSimMode] = useState('maritimo')
  const [importId, setImportId] = useState('')
  const [importProdId, setImportProdId] = useState('')
  const [importMode, setImportMode] = useState('maritimo')
  const [importCosto, setImportCosto] = useState(null)

  const [simulaciones, setSimulaciones] = useState([])
  const importaciones = loadImportaciones()
  const selectedImport = importaciones.find(i => i.id === parseInt(importId))

  useEffect(() => { loadSimulaciones().then(setSimulaciones) }, [])

  useEffect(() => {
    if (costoSource !== 'importacion' || !importId || !importProdId || !selectedImport) {
      setImportCosto(null); return
    }
    setImportCosto(calcImportProductoCosto(selectedImport, importProdId, importMode))
  }, [costoSource, importId, importProdId, importMode, selectedImport])

  const handleSave = () => {
    if (!nombre.trim()) return
    if (sku.trim() && existingProductos.some(p => p.sku && p.sku.toLowerCase() === sku.trim().toLowerCase())) {
      alert(`El SKU "${sku.trim()}" ya existe en el catálogo.`)
      return
    }
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
      mlItemId: mlItemId || null,
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

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Publicación ML <span>(opcional)</span></label>
          <MLItemSelector value={mlItemId} onChange={setMlItemId} />
          <p className="form-hint">Vinculá con una publicación de ML para ver el margen real en el Dashboard.</p>
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
  const showToast = useToast()
  const [mlPct, setMlPct] = useState(producto.mlPct ?? 25)
  const [adsPct, setAdsPct] = useState(producto.adsPct ?? 12)
  const [ivaPct, setIvaPct] = useState(producto.ivaPct ?? 14)
  const [iibbPct, setIibbPct] = useState(producto.iibbPct ?? 0)
  const [otrosPct, setOtrosPct] = useState(producto.otrosPct ?? 0)
  const [precioActual, setPrecioActual] = useState(producto.precioActual ? String(producto.precioActual) : '')
  const [precioCustom, setPrecioCustom] = useState('')
  const [targetMargen, setTargetMargen] = useState(20)
  const [modoTarget, setModoTarget] = useState('precio')
  const [isEditing, setIsEditing] = useState(false)
  const [editNombre, setEditNombre] = useState(producto.nombre)
  const [editSku, setEditSku] = useState(producto.sku || '')
  const [editingML, setEditingML] = useState(false)
  const [tempMlItemId, setTempMlItemId] = useState(producto.mlItemId || null)
  const [updateFlash, setUpdateFlash] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [simulaciones, setSimulaciones] = useState([])
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPublicar, setShowPublicar] = useState(false)
  const meliConnected = !!getMeliConnection()

  useEffect(() => { loadSimulaciones().then(setSimulaciones) }, [])

  const costoARS = producto.costoUnitARS
  const factorNeto = 1 - mlPct/100 - adsPct/100 - ivaPct/100 - iibbPct/100 - otrosPct/100
  const roundPrice = (p) => Math.ceil(p / 1000) * 1000

  const params = { costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct }
  const resultadoTarget = costoARS ? calcPricing({ ...params, targetMargen, modoTarget }) : null

  const precioNum = parseFloat(precioCustom)
  const resultadoCustom = costoARS && precioCustom && !isNaN(precioNum) && precioNum > 0 ? (() => {
    const netoML = precioNum * (1 - mlPct / 100)
    const netoUnitario = precioNum * factorNeto
    const margenUnitario = netoUnitario - costoARS
    return { precio: precioNum, netoML, netoUnitario, margenUnitario, margenSobrePrecio: margenUnitario / precioNum, margenSobreCosto: costoARS ? margenUnitario / costoARS : 0 }
  })() : null

  const displayResult = resultadoCustom || resultadoTarget

  const handleSavePricing = () => {
    const savedPrecio = parseFloat(precioActual) || (displayResult ? roundPrice(displayResult.precio) : null)
    onUpdate(producto.id, { mlPct, adsPct, ivaPct, iibbPct, otrosPct, precioActual: savedPrecio || null })
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2000)
    showToast('Pricing guardado ✓', 'success')
  }

  const handleActualizarCosto = () => {
    if (producto.costoSource === 'simulacion' && producto.simulacionId) {
      const sim = simulaciones.find(s => s.id === producto.simulacionId)
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
    showToast('Costo actualizado ✓', 'success')
  }

  const mlItems = useMemo(() => getCachedItems()?.items || [], [])
  const vinculoML = producto.mlItemId ? mlItems.find(m => m.id === producto.mlItemId) : null

  const vinculoSim = producto.simulacionId
    ? simulaciones.find(s => s.id === producto.simulacionId)
    : null
  const vinculoImp = producto.importacionId
    ? loadImportaciones().find(i => i.id === producto.importacionId)
    : null

  return (
    <div>
      {confirmDel && (
        <ConfirmModal
          title="Eliminar producto"
          message={`¿Eliminar "${producto.nombre}" del catálogo? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { onDelete(producto.id); onBack(); showToast('Producto eliminado', 'success') }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
      {showPublicar && (
        <PublicarMLModal
          producto={producto}
          onClose={() => setShowPublicar(false)}
          onPublished={(mlItemId) => {
            onUpdate(producto.id, { mlItemId })
            showToast('✓ Publicado en ML y vinculado al producto', 'success')
          }}
        />
      )}
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
                <button className="btn-sm danger" onClick={() => setConfirmDel(true)}>🗑</button>
              </div>
            </div>
          )}
        </div>
        {/* Publicar en ML — solo si ML conectado y no hay publicación vinculada */}
        {meliConnected && !vinculoML && (
          <button className="btn-sm primary" style={{ flexShrink: 0 }} onClick={() => setShowPublicar(true)}>
            🚀 Publicar en ML ↗
          </button>
        )}
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
          {/* Porcentajes */}
          <div className="pct-inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: '%ML', val: mlPct, set: setMlPct, hint: 'Comisión ML' },
              { label: '%Ads', val: adsPct, set: setAdsPct, hint: 'Publicidad' },
              { label: '%IVA', val: ivaPct, set: setIvaPct, hint: 'IVA ML' },
              { label: '%IIBB', val: iibbPct, set: setIibbPct, hint: 'Ing. Brutos' },
              { label: '%Otros', val: otrosPct, set: setOtrosPct, hint: 'Variables extra' },
            ].map(({ label, val, set, hint }) => (
              <div key={label} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{label}</label>
                <input className="form-input mono" type="number" min="0" max="100" step="0.5"
                  value={val} onChange={e => set(parseFloat(e.target.value) || 0)} />
                <p className="form-hint">{hint}</p>
              </div>
            ))}
          </div>

          {/* Factor neto */}
          <div style={{ background: 'var(--bg-soft)', borderRadius: 6, padding: '7px 12px', marginBottom: 14, fontSize: 12, color: 'var(--ink-mute)' }}>
            Factor neto = <strong>{fmt(factorNeto * 100, 2)}%</strong> del precio queda para costo + margen.
            {' '}Si usás crédito fiscal del import, podés bajar IVA a ~14%.
          </div>

          {/* Target + precio directo */}
          <div className="pricing-target-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="form-label">Target de margen</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="form-input" value={modoTarget} onChange={e => setModoTarget(e.target.value)}
                  style={{ flex: '0 0 auto', width: 'auto', paddingRight: 24 }}>
                  <option value="precio">% sobre precio</option>
                  <option value="costo">% sobre costo</option>
                </select>
                <input className="form-input mono" type="number" min="0" max="999" step="1"
                  value={targetMargen} onChange={e => setTargetMargen(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <label className="form-label">O ingresá precio directo <span>ARS</span></label>
              <input className="form-input mono" type="number" min="0" step="1000"
                value={precioCustom} onChange={e => setPrecioCustom(e.target.value)} placeholder="Ej: 180000" />
              <p className="form-hint">Calculamos el margen resultante</p>
            </div>
          </div>

          {!costoARS && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-alt)', borderRadius: 6, fontSize: 13, color: 'var(--ink-mute)', marginBottom: 14 }}>
              Sin costo base — cargá el costo unitario para activar la simulación.
            </div>
          )}

          {/* Resultado principal */}
          {costoARS && displayResult && (
            <div style={{
              border: `2px solid ${displayResult.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)'}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 14,
              background: displayResult.margenUnitario >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Precio sugerido</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                    {fmtARS(precioCustom ? displayResult.precio : roundPrice(displayResult.precio))}
                  </div>
                  {!precioCustom && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Exacto: {fmtARS(displayResult.precio)}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Margen / unidad</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: displayResult.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {fmtARS(displayResult.margenUnitario)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>% precio / costo</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                    {fmt(displayResult.margenSobrePrecio * 100, 1)}% / {fmt((displayResult.margenSobreCosto ?? 0) * 100, 1)}%
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="kpi-row">
                  <span className="kpi-row-label">Neto ML (después comisión)</span>
                  <span className="kpi-row-value">{fmtARS(displayResult.netoML ?? displayResult.netoUnitario)}</span>
                </div>
                <div className="kpi-row">
                  <span className="kpi-row-label">Neto unitario (después de todo)</span>
                  <span className="kpi-row-value">{fmtARS(displayResult.netoUnitario)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Precio actual guardado */}
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio actual guardado <span>ARS</span></label>
              <input className="form-input mono" type="number" min="0" step="1000"
                value={precioActual} onChange={e => setPrecioActual(e.target.value)} placeholder="Precio de venta actual" />
              <p className="form-hint">Se guarda con el producto y aparece en la tabla del catálogo</p>
            </div>
          </div>

          {/* Tabla escenarios */}
          {costoARS && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Escenarios de rentabilidad ({modoTarget === 'precio' ? '% sobre precio' : '% sobre costo'})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>Margen %</th>
                      <th>Precio exacto</th>
                      <th>Precio redondeado</th>
                      <th>Neto unitario</th>
                      <th>Margen ARS</th>
                      <th>% s/ costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ESCENARIOS.map(pct => {
                      const r = calcPricing({ costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, targetMargen: pct, modoTarget })
                      if (!r) return null
                      const esTarget = !precioCustom && pct === targetMargen
                      return (
                        <tr key={pct}
                          style={{ cursor: 'pointer', background: esTarget ? 'var(--brand-light)' : undefined }}
                          title="Click para usar este escenario"
                          onClick={() => { setTargetMargen(pct); setPrecioCustom('') }}>
                          <td style={{ fontWeight: esTarget ? 700 : 400 }}>{esTarget ? '★ ' : ''}{pct}%</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--ink)' }}>{fmtARS(r.precio)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--brand)', fontWeight: 600 }}>{fmtARS(roundPrice(r.precio))}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtARS(r.netoUnitario)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, color: r.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtARS(r.margenUnitario)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(r.margenSobreCosto * 100, 1)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn-sm primary" onClick={handleSavePricing}>
              {saveFlash ? '✓ Guardado' : 'Guardar parámetros y precio'}
            </button>
          </div>
        </div>
      </div>

      {/* Vínculo ML */}
      <div className="card producto-section" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Publicación ML</span>
          {!editingML && (
            <button className="btn-sm" onClick={() => { setTempMlItemId(producto.mlItemId || null); setEditingML(true) }}>
              {vinculoML ? '✏️ Cambiar' : '+ Vincular'}
            </button>
          )}
        </div>
        <div className="card-body">
          {editingML ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MLItemSelector value={tempMlItemId} onChange={setTempMlItemId} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-sm primary" onClick={() => {
                  onUpdate(producto.id, { mlItemId: tempMlItemId })
                  setEditingML(false)
                  showToast('Publicación ML vinculada ✓', 'success')
                }}>Guardar vínculo</button>
                {vinculoML && (
                  <button className="btn-sm danger" onClick={() => {
                    onUpdate(producto.id, { mlItemId: null })
                    setTempMlItemId(null)
                    setEditingML(false)
                    showToast('Vínculo ML eliminado', 'success')
                  }}>Desvincular</button>
                )}
                <button className="btn-sm" onClick={() => setEditingML(false)}>Cancelar</button>
              </div>
            </div>
          ) : vinculoML ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {vinculoML.thumbnail && (
                <img src={vinculoML.thumbnail.replace('http://', 'https://')} alt=""
                  style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 6, background: 'var(--bg-alt)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{vinculoML.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                  {(() => {
                    const ep = vinculoML.sale_price?.amount ?? vinculoML.price
                    const isPromo = vinculoML.sale_price?.amount && vinculoML.sale_price.amount < vinculoML.price
                    return <>
                      {isPromo && <span style={{ fontSize: 10, background: 'var(--neg)', color: '#fff', borderRadius: 3, padding: '1px 4px', marginRight: 5, fontWeight: 700 }}>PROMO</span>}
                      <span style={{ fontWeight: isPromo ? 700 : 400, color: isPromo ? 'var(--neg)' : undefined }}>{fmtARS(ep)}</span>
                      {isPromo && <span style={{ textDecoration: 'line-through', marginLeft: 5, opacity: 0.5 }}>{fmtARS(vinculoML.price)}</span>}
                      {' · '}Stock: {vinculoML.available_quantity}
                    </>
                  })()}
                </div>
                {(() => {
                  if (!producto.costoUnitARS) return null
                  const effectivePrice = vinculoML.sale_price?.amount ?? vinculoML.price
                  const fn = 1 - (producto.mlPct||0)/100 - (producto.adsPct||0)/100 - (producto.ivaPct||0)/100 - (producto.iibbPct||0)/100 - (producto.otrosPct||0)/100
                  const margenARS = effectivePrice * fn - producto.costoUnitARS
                  const margenPct = (margenARS / effectivePrice) * 100
                  const color = margenPct > 20 ? 'var(--pos)' : margenPct > 10 ? 'var(--warn)' : 'var(--neg)'
                  return (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color }}>
                      Margen real: {fmt(margenPct, 1)}% ({fmtARS(margenARS)}/u)
                    </div>
                  )
                })()}
              </div>
              <a href={vinculoML.permalink} target="_blank" rel="noopener noreferrer"
                className="btn-sm" style={{ textDecoration: 'none', flexShrink: 0 }}>
                Ver en ML ↗
              </a>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>
              Sin publicación vinculada. Vinculá para ver el margen real calculado desde el precio de ML.
            </p>
          )}
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
  const showToast = useToast()
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
    showToast(`"${data.nombre}" agregado al catálogo ✓`, 'success')
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
          <NuevoProductoForm onSave={handleNuevo} onCancel={() => setShowNuevo(false)} existingProductos={productos} />
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
