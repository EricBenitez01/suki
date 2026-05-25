import { useState, useEffect, useMemo } from 'react'
import {
  getMeliConnection, clearMeliConnection, getValidToken,
  syncMeliItems, getCachedItems, isCacheStale, fetchUserInfo, MELI_AUTH_URL,
} from '../lib/meli.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { fmtARS, fmt } from '../lib/calculations.js'
import { loadProductos, addProducto, updateProducto } from '../lib/db.js'
import AutoVincularModal from './AutoVincularModal.jsx'
import ImportarCostosModal from './ImportarCostosModal.jsx'

const STATUS_LABEL = {
  active:       { label: 'Activa',       color: 'var(--pos)',    bg: 'var(--pos-bg)' },
  paused:       { label: 'Pausada',      color: 'var(--ink-mute)', bg: 'var(--bg-alt)' },
  closed:       { label: 'Finalizada',   color: 'var(--neg)',    bg: 'var(--neg-bg)' },
  under_review: { label: 'En revisión',  color: 'var(--warn)',   bg: 'var(--warn-bg)' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || { label: status, color: 'var(--ink-mute)', bg: 'var(--bg-alt)' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: s.bg, color: s.color, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ── CargarCostoModal ──────────────────────────────────────────────────────────
function CargarCostoModal({ item, onClose, onSaved }) {
  const showToast = useToast()
  const [nombre, setNombre] = useState(item.title.length > 60 ? item.title.slice(0, 60) : item.title)
  const [sku, setSku] = useState('')
  const [costoARS, setCostoARS] = useState('')
  const [mlPct, setMlPct] = useState(25)
  const [adsPct, setAdsPct] = useState(12)
  const [ivaPct, setIvaPct] = useState(14)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const costo = parseFloat(costoARS)
    if (!nombre.trim() || !costo || costo <= 0) return
    setSaving(true)
    try {
      await addProducto({
        nombre: nombre.trim(),
        sku: sku.trim() || '',
        costoUnitARS: costo,
        costoUnitUSD: null,
        costoSource: 'manual',
        simulacionId: null,
        importacionId: null,
        importacionProductoId: null,
        mlItemId: item.id,
        mlPct, adsPct, ivaPct,
        iibbPct: 0, otrosPct: 0,
        precioActual: item.sale_price?.amount ?? item.price ?? null,
      })
      showToast('✓ Producto vinculado al catálogo', 'success')
      onSaved()
      onClose()
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Cargar costo — {item.id}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre del producto</label>
            <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">SKU <span>(opcional)</span></label>
            <input className="form-input" value={sku} onChange={e => setSku(e.target.value)} placeholder="Ej: AUR-JBL-01" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Costo unitario ARS <span>*</span></label>
            <input
              className="form-input mono" type="number" min="0" step="100"
              value={costoARS} onChange={e => setCostoARS(e.target.value)}
              placeholder="0" autoFocus
            />
            <p className="form-hint">Costo de adquisición o costo landed por unidad.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: '%ML', val: mlPct, set: setMlPct },
              { label: '%Ads', val: adsPct, set: setAdsPct },
              { label: '%IVA', val: ivaPct, set: setIvaPct },
            ].map(({ label, val, set }) => (
              <div key={label} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{label}</label>
                <input className="form-input mono" type="number" min="0" max="100" step="0.5"
                  value={val} onChange={e => set(parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>
          <p className="form-hint">
            Precio ML actual: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
              {fmtARS(item.sale_price?.amount ?? item.price)}
            </strong>
            {item.sale_price?.amount && item.sale_price.amount !== item.price && (
              <span style={{ marginLeft: 6, textDecoration: 'line-through', color: 'var(--ink-mute)' }}>
                {fmtARS(item.price)}
              </span>
            )}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-sm" onClick={onClose}>Cancelar</button>
            <button
              className="btn-sm primary"
              onClick={handleSave}
              disabled={saving || !nombre.trim() || !costoARS || parseFloat(costoARS) <= 0}
            >
              {saving ? '⟳ Guardando…' : '✓ Vincular al dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemCard({ item, onClick, inCatalogo, catalogoProducto, onCargarCosto }) {
  const [imgError, setImgError] = useState(false)
  const thumb = item.thumbnail?.replace('http://', 'https://') || null
  const effectivePrice = item.sale_price?.amount ?? item.price

  return (
    <div className="ml-card-wrap">
      <button className="ml-card" onClick={onClick}>
        <div className="ml-card-img">
          {thumb && !imgError
            ? <img src={thumb} alt={item.title} onError={() => setImgError(true)} />
            : <div className="ml-card-img-placeholder">📦</div>
          }
          {inCatalogo && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: 'var(--pos)', color: '#fff',
              fontSize: 9, fontWeight: 800, padding: '2px 6px',
              borderRadius: 99, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              ✓ Catálogo
            </div>
          )}
        </div>
        <div className="ml-card-body">
          <div className="ml-card-title">{item.title}</div>
          <div className="ml-card-price">
            {fmtARS(effectivePrice)}
            {item.sale_price?.amount && item.sale_price.amount !== item.price && (
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', textDecoration: 'line-through', marginLeft: 5 }}>
                {fmtARS(item.price)}
              </span>
            )}
          </div>
          <div className="ml-card-meta">
            <span style={{ color: item.available_quantity > 0 ? 'var(--pos)' : 'var(--neg)', fontWeight: 600, fontSize: 12 }}>
              {item.available_quantity > 0 ? `Stock: ${item.available_quantity}` : 'Sin stock'}
            </span>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </button>
      {/* Acción de costo */}
      <div style={{ padding: '0 10px 10px' }}>
        {inCatalogo && catalogoProducto?.costoUnitARS ? (
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--pos)',
            background: 'var(--pos-bg)', borderRadius: 6, padding: '4px 8px', textAlign: 'center',
          }}>
            ✓ Costo: {fmtARS(catalogoProducto.costoUnitARS)}
          </div>
        ) : (
          <button
            className="btn-sm"
            style={{ width: '100%', fontSize: 11, padding: '4px 0' }}
            onClick={e => { e.stopPropagation(); onCargarCosto(item) }}
          >
            + Cargar costo
          </button>
        )}
      </div>
    </div>
  )
}

function ItemDetail({ item, onBack }) {
  const [imgError, setImgError] = useState(false)
  const img = item.pictures?.[0]?.url?.replace('http://', 'https://')
            || item.thumbnail?.replace('http://', 'https://') || null

  return (
    <div className="ml-detail">
      <button className="producto-back-btn" onClick={onBack}>← Volver al catálogo ML</button>

      <div className="page-header" style={{ marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: 18 }}>{item.title}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={item.status} />
            <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
              {item.id}
            </span>
          </div>
        </div>
        <a
          href={item.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-sm primary"
          style={{ textDecoration: 'none', flexShrink: 0 }}
        >
          Ver en ML ↗
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 16 }}>
        {/* Imagen */}
        <div style={{
          background: 'var(--bg-alt)', borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, overflow: 'hidden',
        }}>
          {img && !imgError
            ? <img src={img} alt={item.title} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} onError={() => setImgError(true)} />
            : <span style={{ fontSize: 48 }}>📦</span>
          }
        </div>

        {/* Datos */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="kpi-label">Precio de venta</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>
                {fmtARS(item.price)}
              </div>
              {item.original_price && item.original_price !== item.price && (
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', textDecoration: 'line-through' }}>
                  {fmtARS(item.original_price)}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="kpi-label">Stock disponible</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18,
                  color: item.available_quantity > 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {item.available_quantity}
                </div>
              </div>
              <div>
                <div className="kpi-label">Vendidos</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>
                  {item.sold_quantity ?? '—'}
                </div>
              </div>
              <div>
                <div className="kpi-label">Condición</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {item.condition === 'new' ? 'Nuevo' : item.condition === 'used' ? 'Usado' : item.condition}
                </div>
              </div>
              <div>
                <div className="kpi-label">Modo de envío</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {item.shipping?.free_shipping ? '🚚 Gratis' : 'A cargo del comprador'}
                </div>
              </div>
            </div>

            {item.category_id && (
              <div>
                <div className="kpi-label">Categoría ID</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-mute)' }}>
                  {item.category_id}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atributos */}
      {item.attributes?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Atributos</div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {item.attributes.slice(0, 12).map(attr => (
              <div key={attr.id}>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase' }}>{attr.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{attr.value_name || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NotConnected() {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '60px auto' }}>
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-state-icon">🟡</div>
          <div className="empty-state-title">Conectá tu cuenta de ML</div>
          <div className="empty-state-text">
            Sincronizá tus publicaciones de Mercado Libre para ver precios, stock y métricas directamente en Suki.
          </div>
          <a
            href={MELI_AUTH_URL}
            style={{
              marginTop: 20, display: 'inline-block',
              background: 'var(--brand)', color: '#fff',
              padding: '10px 24px', borderRadius: 'var(--radius)',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}
          >
            Conectar con MercadoLibre →
          </a>
        </div>
      </div>
    </div>
  )
}

export default function MLPublicacionesPanel() {
  const showToast = useToast()
  const [connection, setConnection] = useState(getMeliConnection)
  const [userInfo, setUserInfo] = useState(null)
  const [items, setItems] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showAutoVincular, setShowAutoVincular] = useState(false)
  const [cargarCostoItem, setCargarCostoItem] = useState(null)
  const [showImportarCostos, setShowImportarCostos] = useState(false)

  useEffect(() => {
    loadProductos().then(setProductos)
  }, [])

  useEffect(() => {
    if (!connection) return
    getValidToken().then(token => {
      if (token) fetchUserInfo(connection.user_id, token).then(info => { if (info) setUserInfo(info) })
    })
    const cache = getCachedItems()
    if (cache?.items) {
      setItems(cache.items)
      setLastSynced(cache.synced_at)
      if (isCacheStale()) handleSync(true)
    } else {
      handleSync(true)
    }
  }, [connection])

  const handleSync = async (silent = false) => {
    if (!connection) return
    if (!silent) setSyncing(true)
    else setLoading(true)
    try {
      const token = await getValidToken()
      if (!token) { showToast('Token expirado — reconectá ML', 'error'); return }
      const synced = await syncMeliItems(connection.user_id, token)
      setItems(synced)
      setLastSynced(Date.now())
      if (!silent) showToast(`${synced.length} publicaciones sincronizadas ✓`, 'success')
    } catch (err) {
      showToast(`Error al sincronizar: ${err.message}`, 'error')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    clearMeliConnection()
    setConnection(null)
    setItems([])
    showToast('Cuenta ML desconectada', 'success')
  }

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || item.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [items, search, statusFilter])

  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter(i => i.status === 'active').length,
    paused: items.filter(i => i.status === 'paused').length,
  }), [items])

  if (!connection) return <NotConnected />

  if (selectedItem) {
    return <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />
  }

  const refreshProductos = () => loadProductos().then(setProductos)

  return (
    <div>
      {showImportarCostos && (
        <ImportarCostosModal
          productos={productos}
          onClose={() => setShowImportarCostos(false)}
          onDone={refreshProductos}
        />
      )}
      {showAutoVincular && (
        <AutoVincularModal
          productos={productos}
          mlItems={items}
          onClose={() => setShowAutoVincular(false)}
          onDone={refreshProductos}
        />
      )}
      {cargarCostoItem && (
        <CargarCostoModal
          item={cargarCostoItem}
          onClose={() => setCargarCostoItem(null)}
          onSaved={refreshProductos}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Publicaciones ML</h1>
          <p className="page-subtitle">
            {userInfo ? `${userInfo.nickname} (#${connection.user_id})` : `Usuario #${connection.user_id}`}
            {lastSynced && ` · Sync: ${new Date(lastSynced).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-sm primary" onClick={() => handleSync(false)} disabled={syncing}>
            {syncing ? '⟳ Sincronizando…' : '🔄 Sincronizar'}
          </button>
          <button className="btn-sm" onClick={() => setShowImportarCostos(true)}>
            📥 Importar costos
          </button>
          {items.length > 0 && productos.some(p => !p.mlItemId) && (
            <button className="btn-sm" onClick={() => setShowAutoVincular(true)}>
              ✨ Auto-vincular
            </button>
          )}
          <button className="btn-sm danger" onClick={handleDisconnect}>Desconectar</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>🔍</span>
          <input
            className="form-input"
            placeholder="Buscar por título o ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="pill-toggle">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>
            Todas ({counts.all})
          </button>
          <button className={statusFilter === 'active' ? 'active' : ''} onClick={() => setStatusFilter('active')}>
            Activas ({counts.active})
          </button>
          <button className={statusFilter === 'paused' ? 'active' : ''} onClick={() => setStatusFilter('paused')}>
            Pausadas ({counts.paused})
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-text">Cargando publicaciones…</div>
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">Sin publicaciones</div>
              <div className="empty-state-text">
                No se encontraron publicaciones en la cuenta <strong>{userInfo?.nickname || `#${connection.user_id}`}</strong>.
              </div>
              {userInfo && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-mute)', background: 'var(--bg-alt)', padding: '10px 16px', borderRadius: 'var(--radius)', textAlign: 'left', maxWidth: 360 }}>
                  <div>Cuenta: <strong>{userInfo.nickname}</strong></div>
                  <div>Tipo: <strong>{userInfo.account_type || userInfo.user_type || '—'}</strong></div>
                  <div style={{ marginTop: 6, color: 'var(--warn)' }}>
                    ¿Es la cuenta vendedora de Kyrax? Si no, desconectá y volvé a conectar con la cuenta correcta.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && items.length > 0 && (
        <p className="text-mute" style={{ textAlign: 'center', padding: '40px 0' }}>
          Sin resultados para "{search}"
        </p>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="ml-grid">
            {filtered.map(item => {
              const catalogoProd = productos.find(p => p.mlItemId === item.id)
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedItem(item)}
                  inCatalogo={!!catalogoProd}
                  catalogoProducto={catalogoProd}
                  onCargarCosto={setCargarCostoItem}
                />
              )
            })}
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 12, textAlign: 'right' }}>
            {filtered.length} publicación{filtered.length !== 1 ? 'es' : ''}
            {filtered.length !== items.length && ` de ${items.length}`}
          </p>
        </>
      )}
    </div>
  )
}
