import { useState, useMemo, useEffect } from 'react'
import { calcularComparativa, DEFAULTS, fmtUSD, fmtARS, fmt } from '../lib/calculations.js'
import { addProducto } from '../lib/productos.js'
import * as db from '../lib/db.js'

const STATUSES = [
  { id: 'cotizando',   label: 'Cotizando',      color: '#64748b' },
  { id: 'confirmado',  label: 'Confirmado',      color: '#1e40af' },
  { id: 'produccion',  label: 'En producción',   color: '#b45309' },
  { id: 'despachado',  label: 'Despachado',      color: '#0369a1' },
  { id: 'en_transito', label: 'En tránsito',     color: '#0f766e' },
  { id: 'en_aduana',   label: 'En aduana',       color: '#b45309' },
  { id: 'recibido',    label: 'Recibido',        color: '#15803d' },
]


const emptyForm = () => ({
  nombre: '',
  fecha: new Date().toISOString().split('T')[0],
  status: 'cotizando',
  fleteMode: 'maritimo',
  tc: String(DEFAULTS.tc),
  notas: '',
})

const emptyProducto = () => ({
  id: null,
  nombre: '',
  unidades: '',
  fobUnit: '',
  pesoKg: '',
  di: '',
  ncm: '',
  proveedor: '',
  linkAlibaba: '',
})

function calcProducto(prod, tc, fleteMode) {
  const fob = parseFloat(prod.fobUnit) * parseFloat(prod.unidades)
  if (!fob || !prod.unidades || !prod.pesoKg || prod.di === '') return null
  const values = {
    ...DEFAULTS,
    fob,
    unidades: parseFloat(prod.unidades),
    pesoKg: parseFloat(prod.pesoKg),
    di: parseFloat(prod.di),
    tc: parseFloat(tc) || DEFAULTS.tc,
    fleteAereoModo: 'calculado',
    fleteAereoCotizacion: '',
    bultos: 1,
    largoCm: '', anchoCm: '', altoCm: '',
  }
  const r = calcularComparativa(values)
  return fleteMode === 'aereo' ? r.aereo : r.maritimo
}

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.id === status) || STATUSES[0]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
      background: s.color + '22', color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      border: `1px solid ${s.color}55`,
    }}>
      {s.label}
    </span>
  )
}

function ProductForm({ initial, onSave, onCancel }) {
  const [p, setP] = useState(initial || emptyProducto())
  const set = k => e => setP(prev => ({ ...prev, [k]: e.target.value }))
  const canSave = p.nombre && p.unidades && p.fobUnit && p.pesoKg && p.di !== ''

  return (
    <div style={{ background: 'var(--bg-soft)', border: '1.5px solid var(--brand-mid)', borderRadius: 10, padding: 16, marginTop: 8 }}>
      <div className="form-group">
        <label className="form-label">Nombre del producto <span style={{ color: 'var(--neg)' }}>*</span></label>
        <input className="form-input" value={p.nombre} onChange={set('nombre')} placeholder="Ej: Auriculares JBL Tune 510" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Unidades <span style={{ color: 'var(--neg)' }}>*</span></label>
          <input className="form-input mono" type="number" min="1" value={p.unidades} onChange={set('unidades')} placeholder="100" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">FOB/unidad USD <span style={{ color: 'var(--neg)' }}>*</span></label>
          <input className="form-input mono" type="number" min="0" step="0.01" value={p.fobUnit} onChange={set('fobUnit')} placeholder="25.00" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Peso total kg <span style={{ color: 'var(--neg)' }}>*</span></label>
          <input className="form-input mono" type="number" min="0" step="0.1" value={p.pesoKg} onChange={set('pesoKg')} placeholder="15.0" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">DI % <span style={{ color: 'var(--neg)' }}>*</span></label>
          <input className="form-input mono" type="number" min="0" max="100" value={p.di} onChange={set('di')} placeholder="35" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Proveedor</label>
          <input className="form-input" value={p.proveedor} onChange={set('proveedor')} placeholder="Shenzhen Audio Co." />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">NCM</label>
          <input className="form-input mono" value={p.ncm} onChange={set('ncm')} placeholder="8518.30.00" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Link Alibaba</label>
          <input className="form-input" type="url" value={p.linkAlibaba} onChange={set('linkAlibaba')} placeholder="https://..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-sm" onClick={onCancel}>Cancelar</button>
        <button className="btn-sm primary" disabled={!canSave} onClick={() => onSave({ ...p, id: p.id || Date.now() })}>
          {initial?.id ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </div>
    </div>
  )
}

function ProductRow({ prod, calc, importacionId, onEdit, onDelete }) {
  const [catalogFlash, setCatalogFlash] = useState(false)

  const handleAddCatalog = () => {
    if (!calc) return
    addProducto({
      nombre: prod.nombre,
      sku: '',
      mlPct: 25, adsPct: 12, ivaPct: 14, iibbPct: 0, otrosPct: 0,
      precioActual: null,
      costoUnitARS: calc.costoUnitARS,
      costoUnitUSD: calc.costoUnitUSD,
      costoSource: 'importacion',
      simulacionId: null,
      importacionId: importacionId ?? null,
      importacionProductoId: prod.id ?? null,
    })
    setCatalogFlash(true)
    setTimeout(() => setCatalogFlash(false), 2500)
  }

  return (
    <div className="import-product-row">
      <div className="import-product-main">
        <div className="import-product-name">
          {prod.nombre}
          {prod.linkAlibaba && (
            <a href={prod.linkAlibaba} target="_blank" rel="noopener noreferrer" className="import-link" title="Ver en Alibaba">
              🔗
            </a>
          )}
        </div>
        <div className="import-product-meta">
          {fmt(prod.unidades, 0)} uds · FOB {fmtUSD(parseFloat(prod.fobUnit) * parseFloat(prod.unidades))}
          {' '}· {prod.pesoKg} kg · DI {prod.di}%
          {prod.proveedor && ` · ${prod.proveedor}`}
          {prod.ncm && ` · NCM ${prod.ncm}`}
        </div>
      </div>
      <div className="import-product-costs">
        {calc ? (
          <>
            <span className="import-cost-label">Landed</span>
            <span className="import-cost-value">{fmtUSD(calc.totalUSD)}</span>
            <span className="import-cost-sub">{fmtUSD(calc.costoUnitUSD)}/ud</span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>—</span>
        )}
      </div>
      <div className="import-product-actions">
        {catalogFlash
          ? <span className="import-catalog-flash">Agregado ✓</span>
          : <button className="btn-sm" title="Agregar al catálogo" onClick={handleAddCatalog} disabled={!calc}>🛍️</button>
        }
        <button className="btn-sm" onClick={onEdit}>✏️</button>
        <button className="btn-sm danger" onClick={onDelete}>🗑</button>
      </div>
    </div>
  )
}

function ImportForm({ initial, onSave, onCancel }) {
  const importacionId = initial?.id ?? null
  const [form, setForm] = useState(initial?.form || emptyForm())
  const [productos, setProductos] = useState(initial?.productos || [])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProd, setEditingProd] = useState(null)

  const setF = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const calcs = useMemo(() =>
    productos.map(p => calcProducto(p, form.tc, form.fleteMode)),
    [productos, form.tc, form.fleteMode]
  )

  const totals = useMemo(() => {
    const valid = calcs.filter(Boolean)
    if (!valid.length) return null
    return {
      totalUSD: valid.reduce((s, c) => s + c.totalUSD, 0),
      totalARS: valid.reduce((s, c) => s + c.totalARS, 0),
      totalFOB: productos.reduce((s, p) => s + (parseFloat(p.fobUnit) * parseFloat(p.unidades) || 0), 0),
      totalUnidades: productos.reduce((s, p) => s + (parseFloat(p.unidades) || 0), 0),
    }
  }, [calcs, productos])

  const handleSaveProd = (prod) => {
    if (editingProd) {
      setProductos(prev => prev.map(p => p.id === prod.id ? prod : p))
      setEditingProd(null)
    } else {
      setProductos(prev => [...prev, prod])
      setShowAddProduct(false)
    }
  }

  const handleSubmit = () => {
    if (!form.nombre.trim()) return
    onSave({ form, productos })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{initial ? 'Editar importación' : 'Nueva importación'}</h1>
          <p className="page-subtitle">Agregá productos, proveedores y calculá el costo consolidado del lote</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="btn-sm primary" onClick={handleSubmit} disabled={!form.nombre.trim()}>
            💾 Guardar importación
          </button>
        </div>
      </div>

      {/* Info básica */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Datos generales</div>
        <div className="card-body">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Nombre de la importación <span style={{ color: 'var(--neg)' }}>*</span></label>
              <input className="form-input" value={form.nombre} onChange={setF('nombre')} placeholder="Ej: Importación electrónica mayo 2026" autoFocus />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={form.fecha} onChange={setF('fecha')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Estado</label>
              <select className="form-input" value={form.status} onChange={setF('status')}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Modo de flete</label>
              <div className="pill-toggle" style={{ marginBottom: 0 }}>
                <button className={form.fleteMode === 'maritimo' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, fleteMode: 'maritimo' }))}>🚢 Marítimo</button>
                <button className={form.fleteMode === 'aereo' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, fleteMode: 'aereo' }))}>✈ Aéreo</button>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo de cambio ARS/USD</label>
              <input className="form-input mono" type="number" value={form.tc} onChange={setF('tc')} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: 12 }}>
            <label className="form-label">Notas</label>
            <textarea className="form-input" rows={2} value={form.notas} onChange={setF('notas')} placeholder="Observaciones generales, condiciones, banco, etc." style={{ resize: 'vertical' }} />
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="card">
        <div className="card-header">
          <span>Productos ({productos.length})</span>
          {totals && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)' }}>
              FOB total {fmtUSD(totals.totalFOB)} · Landed {fmtUSD(totals.totalUSD)}
            </span>
          )}
        </div>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          {productos.length === 0 && !showAddProduct && (
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', textAlign: 'center', padding: '20px 0' }}>
              Todavía no hay productos. Agregá el primero.
            </p>
          )}

          {productos.map((prod, i) => (
            editingProd?.id === prod.id
              ? <ProductForm key={prod.id} initial={editingProd} onSave={handleSaveProd} onCancel={() => setEditingProd(null)} />
              : <ProductRow
                  key={prod.id}
                  prod={prod}
                  calc={calcs[i]}
                  importacionId={importacionId}
                  onEdit={() => { setShowAddProduct(false); setEditingProd(prod) }}
                  onDelete={() => setProductos(prev => prev.filter(p => p.id !== prod.id))}
                />
          ))}

          {showAddProduct && !editingProd && (
            <ProductForm onSave={handleSaveProd} onCancel={() => setShowAddProduct(false)} />
          )}

          {!showAddProduct && !editingProd && (
            <button
              className="btn-sm primary"
              style={{ marginTop: productos.length > 0 ? 12 : 0 }}
              onClick={() => setShowAddProduct(true)}
            >
              + Agregar producto
            </button>
          )}
        </div>

        {/* Totales */}
        {totals && (
          <div style={{ borderTop: '2px solid var(--line)', padding: '14px 20px', background: 'var(--bg-alt)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Productos', val: productos.length, mono: false },
              { label: 'Total unidades', val: fmt(totals.totalUnidades, 0), mono: true },
              { label: 'FOB total', val: fmtUSD(totals.totalFOB), mono: true },
              { label: 'Costo landed total', val: fmtUSD(totals.totalUSD), mono: true, highlight: true },
            ].map(({ label, val, mono, highlight }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-mute)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: 16, fontWeight: 700, color: highlight ? 'var(--brand)' : 'var(--ink)' }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ImportCard({ imp, calcs, onEdit, onDelete }) {
  const totalFOB = imp.productos.reduce((s, p) => s + (parseFloat(p.fobUnit) * parseFloat(p.unidades) || 0), 0)
  const validCalcs = calcs.filter(Boolean)
  const totalLanded = validCalcs.reduce((s, c) => s + c.totalUSD, 0)

  return (
    <div className="sim-card">
      <div className="sim-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <StatusBadge status={imp.form.status} />
          <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {new Date(imp.form.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="sim-card-title">{imp.form.nombre}</div>
        <div className="sim-card-meta">
          {imp.form.fleteMode === 'maritimo' ? '🚢 Marítimo' : '✈ Aéreo'}
          {' · '}{imp.productos.length} producto{imp.productos.length !== 1 ? 's' : ''}
          {imp.form.notas && ` · ${imp.form.notas.slice(0, 40)}${imp.form.notas.length > 40 ? '…' : ''}`}
        </div>
      </div>
      <div className="sim-card-body">
        {imp.productos.slice(0, 3).map((p, i) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--ink-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', marginLeft: 8 }}>
              {calcs[i] ? fmtUSD(calcs[i].totalUSD) : '—'}
            </span>
          </div>
        ))}
        {imp.productos.length > 3 && (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>+{imp.productos.length - 3} más</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase' }}>FOB total</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)' }}>{fmtUSD(totalFOB)}</div>
          </div>
          {totalLanded > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase' }}>Landed total</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand)' }}>{fmtUSD(totalLanded)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="sim-card-footer">
        <button className="btn-sm primary" style={{ flex: 1 }} onClick={onEdit}>Abrir importación</button>
        <button className="btn-sm danger" onClick={onDelete}>🗑</button>
      </div>
    </div>
  )
}

export default function ImportacionesPanel() {
  const [importaciones, setImportaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [formView, setFormView] = useState(false)
  const [editingImp, setEditingImp] = useState(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    db.loadImportaciones().then(data => { setImportaciones(data); setLoading(false) })
  }, [])

  const handleSave = async ({ form, productos }) => {
    const newId = await db.saveImportacion(editingImp?.id ?? null, form, productos)
    setImportaciones(prev =>
      editingImp
        ? prev.map(x => x.id === editingImp.id ? { id: editingImp.id, form, productos } : x)
        : [{ id: newId, form, productos }, ...prev]
    )
    setFormView(false)
    setEditingImp(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta importación?')) return
    await db.deleteImportacion(id)
    setImportaciones(prev => prev.filter(x => x.id !== id))
  }

  const handleEdit = (imp) => {
    setEditingImp(imp)
    setFormView(true)
  }

  if (loading) return <div className="empty-state" style={{ marginTop: 60 }}><div className="empty-state-text">Cargando importaciones…</div></div>

  if (formView) {
    return (
      <ImportForm
        initial={editingImp}
        onSave={handleSave}
        onCancel={() => { setFormView(false); setEditingImp(null) }}
      />
    )
  }

  const filtered = importaciones.filter(x =>
    x.form.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    x.productos.some(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()))
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Importaciones</h1>
          <p className="page-subtitle">{importaciones.length} importación{importaciones.length !== 1 ? 'es' : ''} guardada{importaciones.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {importaciones.length > 0 && (
            <input
              className="form-input"
              type="text"
              placeholder="Buscar…"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              style={{ width: 200 }}
            />
          )}
          <button className="btn-sm primary" onClick={() => { setEditingImp(null); setFormView(true) }}>
            + Nueva importación
          </button>
        </div>
      </div>

      {importaciones.length === 0 ? (
        <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">Sin importaciones todavía</div>
              <div className="empty-state-text">
                Creá tu primera importación para registrar productos, proveedores, links de Alibaba y calcular el costo consolidado del lote.
              </div>
              <button className="btn-sm primary" style={{ marginTop: 20 }} onClick={() => setFormView(true)}>
                + Nueva importación
              </button>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-mute" style={{ textAlign: 'center', padding: '40px 0' }}>
          Ninguna importación coincide con "{filtro}"
        </p>
      ) : (
        <div className="sim-grid">
          {filtered.map(imp => {
            const calcs = imp.productos.map(p => calcProducto(p, imp.form.tc, imp.form.fleteMode))
            return (
              <ImportCard
                key={imp.id}
                imp={imp}
                calcs={calcs}
                onEdit={() => handleEdit(imp)}
                onDelete={() => handleDelete(imp.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
