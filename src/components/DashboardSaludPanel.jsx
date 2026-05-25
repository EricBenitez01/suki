import { useState, useEffect, useMemo } from 'react'
import { loadProductos } from '../lib/db.js'
import { getCachedItems, syncMeliItems, getValidToken, getMeliConnection } from '../lib/meli.js'
import { fmtARS, fmt } from '../lib/calculations.js'
import AutoVincularModal from './AutoVincularModal.jsx'

function HealthDot({ health }) {
  return <span className={`health-dot ${health}`} />
}

function HealthBadge({ health, margenPct }) {
  if (health === 'sin_datos') return <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Sin datos</span>
  const colors = { verde: 'var(--pos)', amarillo: 'var(--warn)', rojo: 'var(--neg)' }
  const labels = { verde: 'Saludable', amarillo: 'Atención', rojo: 'Crítico' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      color: colors[health],
      background: health === 'verde' ? 'var(--pos-bg)' : health === 'amarillo' ? 'var(--warn-bg)' : 'var(--neg-bg)',
    }}>
      <HealthDot health={health} />
      {margenPct != null ? `${fmt(margenPct, 1)}%` : labels[health]}
    </span>
  )
}

function StockBadge({ qty, threshold = 3 }) {
  if (qty == null) return null
  if (qty === 0) return (
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neg)', background: 'var(--neg-bg)', padding: '2px 7px', borderRadius: 99 }}>
      Sin stock
    </span>
  )
  if (qty <= threshold) return (
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', padding: '2px 7px', borderRadius: 99 }}>
      Stock: {qty}
    </span>
  )
  return <span style={{ fontSize: 12, color: 'var(--pos)', fontWeight: 600 }}>{qty}</span>
}

export default function DashboardSaludPanel({ onNavigate }) {
  const [productos, setProductos] = useState([])
  const [mlItems, setMlItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('health')
  const [showAutoVincular, setShowAutoVincular] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const stockThreshold = (() => {
    try { return parseInt(localStorage.getItem('suki_stock_threshold')) || 3 } catch { return 3 }
  })()

  useEffect(() => {
    loadProductos().then(prods => {
      setProductos(prods)
      const cache = getCachedItems()
      if (cache?.items) setMlItems(cache.items)
      setLoading(false)
    })
  }, [])

  // Sync ML + open auto-vincular in one step
  const handleSyncAndVincular = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const conn = getMeliConnection()
      if (!conn?.user_id) { setSyncError('Conectá tu cuenta de ML primero.'); setSyncing(false); return }
      const token = await getValidToken()
      if (!token) { setSyncError('Token inválido. Reconectá tu cuenta ML.'); setSyncing(false); return }
      const items = await syncMeliItems(conn.user_id, token)
      setMlItems(items)
      setShowAutoVincular(true)
    } catch (e) {
      setSyncError('Error al sincronizar: ' + e.message)
    }
    setSyncing(false)
  }

  const enriched = useMemo(() => {
    return productos.map(p => {
      const mlItem = mlItems.find(m => m.id === p.mlItemId)
      if (!mlItem || !p.costoUnitARS) {
        return { ...p, mlItem: mlItem || null, health: 'sin_datos', margenARS: null, margenPct: null, netoML: null }
      }
      const factorNeto = 1 - (p.mlPct||0)/100 - (p.adsPct||0)/100 - (p.ivaPct||0)/100 - (p.iibbPct||0)/100 - (p.otrosPct||0)/100
      // Usar precio promocional si existe (precio real al que se vende), sino precio normal
      const effectivePrice = mlItem.sale_price?.amount ?? mlItem.price
      const isPromo = mlItem.sale_price?.amount != null && mlItem.sale_price.amount < mlItem.price
      const netoML = effectivePrice * factorNeto
      const margenARS = netoML - p.costoUnitARS
      const margenPct = (margenARS / effectivePrice) * 100
      const health = margenPct > 20 ? 'verde' : margenPct > 10 ? 'amarillo' : 'rojo'
      return { ...p, mlItem, netoML, margenARS, margenPct, health, effectivePrice, isPromo }
    })
  }, [productos, mlItems])

  const kpis = useMemo(() => {
    const vinculados = enriched.filter(p => p.mlItem)
    const negativos = enriched.filter(p => p.health === 'rojo')
    const stockCrit = enriched.filter(p => p.mlItem && (p.mlItem.available_quantity ?? 0) <= stockThreshold && (p.mlItem.available_quantity ?? 0) >= 0)
    const sinVincular = enriched.filter(p => !p.mlItemId)
    const revenue = vinculados.reduce((acc, p) => acc + (p.effectivePrice ?? p.mlItem?.price ?? 0) * (p.mlItem?.available_quantity ?? 0), 0)
    const costoStock = vinculados.reduce((acc, p) => acc + (p.costoUnitARS ?? 0) * (p.mlItem?.available_quantity ?? 0), 0)
    return { total: productos.length, negativos: negativos.length, stockCrit: stockCrit.length, sinVincular: sinVincular.length, revenue, costoStock, ganancia: revenue - costoStock }
  }, [enriched, stockThreshold, productos.length])

  const filtered = useMemo(() => {
    let list = enriched
    if (filter === 'rojo') list = list.filter(p => p.health === 'rojo')
    else if (filter === 'amarillo') list = list.filter(p => p.health === 'amarillo')
    else if (filter === 'verde') list = list.filter(p => p.health === 'verde')
    else if (filter === 'sin_datos') list = list.filter(p => p.health === 'sin_datos')
    if (search) list = list.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.sku||'').toLowerCase().includes(search.toLowerCase()))
    if (sortBy === 'health') {
      const order = { rojo: 0, amarillo: 1, sin_datos: 2, verde: 3 }
      list = [...list].sort((a, b) => (order[a.health] ?? 4) - (order[b.health] ?? 4))
    } else if (sortBy === 'margen') {
      list = [...list].sort((a, b) => (a.margenPct ?? -Infinity) - (b.margenPct ?? -Infinity))
    } else if (sortBy === 'precio') {
      list = [...list].sort((a, b) => (b.mlItem?.price ?? 0) - (a.mlItem?.price ?? 0))
    } else if (sortBy === 'stock') {
      list = [...list].sort((a, b) => (a.mlItem?.available_quantity ?? 9999) - (b.mlItem?.available_quantity ?? 9999))
    }
    return list
  }, [enriched, filter, search, sortBy])

  const hasMeliCache = mlItems.length > 0

  if (loading) {
    return <div className="empty-state" style={{ marginTop: 60 }}><div className="empty-state-text">Cargando dashboard…</div></div>
  }

  return (
    <div>
      {showAutoVincular && (
        <AutoVincularModal
          productos={productos}
          mlItems={mlItems}
          onClose={() => setShowAutoVincular(false)}
          onDone={(count) => {
            loadProductos().then(setProductos)
          }}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard de salud</h1>
          <p className="page-subtitle">
            Margen real por producto · Alertas de stock · P&amp;L potencial
            {hasMeliCache && <span className="page-subtitle-badge"> · {mlItems.length} publicaciones ML</span>}
          </p>
        </div>
        <button className="btn-sm primary" onClick={() => onNavigate('catalogo')}>
          Ir al catálogo →
        </button>
      </div>

      {/* Aviso si no hay ML cache — sync directo sin salir del dashboard */}
      {!hasMeliCache && (
        <div className="alert-item amarillo" style={{ marginBottom: 16 }}>
          <span>🟡</span>
          <div style={{ flex: 1 }}>
            <span>Sincronizá tus publicaciones de ML para ver márgenes reales.</span>
            {syncError && <div style={{ fontSize: 12, color: 'var(--neg)', marginTop: 4 }}>{syncError}</div>}
          </div>
          <button
            className="btn-sm primary"
            style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
            disabled={syncing}
            onClick={handleSyncAndVincular}
          >
            {syncing ? '⏳ Sincronizando…' : '✨ Sincronizar y vincular'}
          </button>
        </div>
      )}

      {/* KPI bar */}
      <div className="dashboard-kpi-bar">
        <div className={`dashboard-kpi-card ${kpis.negativos > 0 ? 'alerta' : ''}`}>
          <div className="kpi-label">Margen negativo / atención</div>
          <div className="kpi-value" style={{ color: kpis.negativos > 0 ? 'var(--neg)' : 'var(--ink)' }}>
            {kpis.negativos}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>productos críticos</div>
        </div>
        <div className={`dashboard-kpi-card ${kpis.stockCrit > 0 ? 'warn' : ''}`}>
          <div className="kpi-label">Stock crítico (≤ {stockThreshold})</div>
          <div className="kpi-value" style={{ color: kpis.stockCrit > 0 ? 'var(--warn)' : 'var(--ink)' }}>
            {kpis.stockCrit}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>publicaciones</div>
        </div>
        <div className="dashboard-kpi-card">
          <div className="kpi-label">Sin vincular a ML</div>
          <div className="kpi-value">{kpis.sinVincular}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
            de {kpis.total} productos
          </div>
        </div>
        <div className="dashboard-kpi-card">
          <div className="kpi-label">Productos en catálogo</div>
          <div className="kpi-value">{kpis.total}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
            {kpis.total - kpis.sinVincular} vinculados a ML
          </div>
        </div>
      </div>

      {/* Alertas */}
      {(kpis.negativos > 0 || kpis.stockCrit > 0 || kpis.sinVincular > 0) && (
        <div className="alert-feed">
          {kpis.negativos > 0 && (
            <div className="alert-item rojo">
              <span>🔴</span>
              <span><strong>{kpis.negativos} producto{kpis.negativos !== 1 ? 's' : ''}</strong> con margen crítico (bajo 10%)</span>
              <button className="btn-sm danger" style={{ marginLeft: 'auto' }} onClick={() => setFilter('rojo')}>
                Ver críticos
              </button>
            </div>
          )}
          {kpis.stockCrit > 0 && (
            <div className="alert-item amarillo">
              <span>🟡</span>
              <span><strong>{kpis.stockCrit} publicación{kpis.stockCrit !== 1 ? 'es' : ''}</strong> con stock ≤ {stockThreshold} unidades</span>
              <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSortBy('stock')}>
                Ordenar por stock
              </button>
            </div>
          )}
          {kpis.sinVincular > 0 && (
            <div className="alert-item">
              <span>⚪</span>
              <span><strong>{kpis.sinVincular} producto{kpis.sinVincular !== 1 ? 's' : ''}</strong> sin publicación ML vinculada</span>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                <button
                  className="btn-sm primary"
                  disabled={syncing}
                  onClick={hasMeliCache ? () => setShowAutoVincular(true) : handleSyncAndVincular}
                >
                  {syncing ? '⏳ Sincronizando…' : hasMeliCache ? '✨ Auto-vincular' : '✨ Sincronizar y vincular'}
                </button>
                <button className="btn-sm" onClick={() => onNavigate('catalogo')}>
                  Manual →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla de salud */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>Tabla de salud</span>
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="health">Ordenar: por salud</option>
            <option value="margen">Ordenar: por margen</option>
            <option value="precio">Ordenar: por precio ML</option>
            <option value="stock">Ordenar: por stock</option>
          </select>
        </div>

        {/* Filtros + búsqueda */}
        <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="pill-toggle" style={{ flexShrink: 0 }}>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos ({enriched.length})</button>
            <button className={filter === 'rojo' ? 'active' : ''} onClick={() => setFilter('rojo')}
              style={{ color: filter !== 'rojo' ? 'var(--neg)' : undefined }}>
              🔴 Críticos ({enriched.filter(p=>p.health==='rojo').length})
            </button>
            <button className={filter === 'amarillo' ? 'active' : ''} onClick={() => setFilter('amarillo')}
              style={{ color: filter !== 'amarillo' ? 'var(--warn)' : undefined }}>
              🟡 Atención ({enriched.filter(p=>p.health==='amarillo').length})
            </button>
            <button className={filter === 'verde' ? 'active' : ''} onClick={() => setFilter('verde')}>
              🟢 OK ({enriched.filter(p=>p.health==='verde').length})
            </button>
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none', fontSize: 13 }}>🔍</span>
            <input className="form-input" style={{ paddingLeft: 30, fontSize: 13 }}
              placeholder="Buscar producto..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {productos.length === 0 ? (
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🛍️</div>
              <div className="empty-state-title">Sin productos en el catálogo</div>
              <div className="empty-state-text">Agregá productos en el catálogo para ver su salud de negocio.</div>
              <button className="btn-sm primary" style={{ marginTop: 12 }} onClick={() => onNavigate('catalogo')}>
                Ir al catálogo
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            Sin resultados para los filtros seleccionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="salud-table">
              <thead>
                <tr style={{ background: 'var(--bg-alt)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Producto</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Precio ML</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Costo</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Margen</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Stock</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-mute)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={`salud-row-${p.health}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HealthDot health={p.health} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.nombre}</div>
                          {p.sku && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{p.sku}</div>}
                          {p.mlItem && (
                            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{p.mlItem.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                      {p.mlItem ? (
                        <div>
                          {fmtARS(p.effectivePrice)}
                          {p.isPromo && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)' }}>
                              PROMO · <span style={{ textDecoration: 'line-through', opacity: .6 }}>{fmtARS(p.mlItem.price)}</span>
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ink-mute)' }}>Sin vincular</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {p.costoUnitARS ? fmtARS(p.costoUnitARS) : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <HealthBadge health={p.health} margenPct={p.margenPct} />
                      {p.margenARS != null && (
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {fmtARS(p.margenARS)}/u
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.mlItem
                        ? <StockBadge qty={p.mlItem.available_quantity} threshold={stockThreshold} />
                        : <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-sm" onClick={() => onNavigate('catalogo')} title="Ajustar pricing">
                          Ajustar →
                        </button>
                        {p.mlItem?.permalink && (
                          <a href={p.mlItem.permalink} target="_blank" rel="noopener noreferrer"
                            className="btn-sm" style={{ textDecoration: 'none' }}>
                            ML ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-mute)' }}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== enriched.length && ` de ${enriched.length}`}
          </div>
        )}
      </div>

      {/* P&L Potencial */}
      {kpis.revenue > 0 && (
        <div className="card">
          <div className="card-header">P&amp;L potencial — stock en mano</div>
          <div className="card-body">
            <div className="pnl-bar">
              <div>
                <div className="kpi-label">Revenue si vendés todo</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>
                  {fmtARS(kpis.revenue)}
                </div>
              </div>
              <div>
                <div className="kpi-label">Costo del stock en mano</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  {fmtARS(kpis.costoStock)}
                </div>
              </div>
              <div>
                <div className="kpi-label">Ganancia potencial</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800,
                  color: kpis.ganancia >= 0 ? 'var(--pos)' : 'var(--neg)',
                }}>
                  {fmtARS(kpis.ganancia)}
                  {kpis.revenue > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8 }}>
                      ({fmt(kpis.ganancia / kpis.revenue * 100, 1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10 }}>
              * Calculado sobre productos vinculados a ML con costo cargado. No incluye comisiones ni impuestos (esos están en el margen por producto).
            </p>
          </div>
        </div>
      )}

      {/* Empty state P&L */}
      {kpis.revenue === 0 && productos.length > 0 && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">P&amp;L potencial</div>
              <div className="empty-state-text">
                Vinculá tus productos del catálogo con sus publicaciones de ML para ver cuánto vale tu stock en mano.
              </div>
              <button className="btn-sm primary" style={{ marginTop: 12 }} onClick={() => onNavigate('catalogo')}>
                Vincular en catálogo →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
