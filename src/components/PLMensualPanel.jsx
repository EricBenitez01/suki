import { useState, useEffect, useMemo } from 'react'
import { getMeliConnection, getValidToken, fetchOrders, fetchAdsSpend, MELI_AUTH_URL } from '../lib/meli.js'
import { loadProductos } from '../lib/db.js'
import { fmtARS, fmt } from '../lib/calculations.js'
import { useToast } from '../contexts/ToastContext.jsx'

const GF_KEY = 'suki_gastos_fijos'
const ADS_KEY = 'suki_ads_mensual' // { 'YYYY-M': number }
function loadGastosFijos() {
  try { return JSON.parse(localStorage.getItem(GF_KEY)) || [] } catch { return [] }
}
function loadAdsManual() {
  try { return JSON.parse(localStorage.getItem(ADS_KEY)) || {} } catch { return {} }
}
function saveAdsManual(map) {
  localStorage.setItem(ADS_KEY, JSON.stringify(map))
}

function getMonthRange(year, month) {
  // month is 0-indexed (0 = Jan)
  const from = new Date(year, month, 1, 0, 0, 0)
  const to   = new Date(year, month + 1, 0, 23, 59, 59)
  const pad  = (n) => String(n).padStart(2, '0')
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000-03:00`
  return { from: fmtDate(from), to: fmtDate(to) }
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: color || 'var(--ink)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function MargenBadge({ pct }) {
  if (pct == null) return <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>—</span>
  const color = pct >= 20 ? 'var(--pos)' : pct >= 10 ? 'var(--warn)' : 'var(--neg)'
  return <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color }}>{fmt(pct, 1)}%</span>
}

export default function PLMensualPanel({ onNavigate }) {
  const showToast = useToast()
  const conn = getMeliConnection()

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [loading, setLoading]   = useState(false)
  const [orders, setOrders]     = useState(null)
  const [productos, setProductos] = useState([])
  const [gastosFijos, setGastosFijos] = useState([])
  const [error, setError]   = useState(null)

  // Ads state
  const [adsSpend, setAdsSpend]       = useState(null)   // number from API or null
  const [adsSource, setAdsSource]     = useState(null)   // 'api' | 'manual' | 'unavailable' | null
  const [adsFetching, setAdsFetching] = useState(false)
  const [adsManualInput, setAdsManualInput] = useState('')
  const [adsManualMap, setAdsManualMap] = useState(loadAdsManual)

  const adsKey = `${year}-${month}`
  const adsManualValue = adsManualMap[adsKey] ?? null

  // Effective ads spend: API value takes priority, then manual
  const effectiveAds = adsSource === 'api' && adsSpend != null ? adsSpend
    : adsManualValue != null ? adsManualValue
    : null

  const saveManualAds = (val) => {
    const v = parseFloat(val)
    const updated = { ...adsManualMap }
    if (!isNaN(v) && v > 0) updated[adsKey] = v
    else delete updated[adsKey]
    setAdsManualMap(updated)
    saveAdsManual(updated)
  }

  useEffect(() => {
    loadProductos().then(setProductos)
    setGastosFijos(loadGastosFijos())
  }, [])

  // Reset ads state when month changes
  useEffect(() => {
    setAdsSpend(null)
    setAdsSource(null)
    setAdsManualInput(adsManualMap[`${year}-${month}`] != null ? String(adsManualMap[`${year}-${month}`]) : '')
  }, [year, month]) // eslint-disable-line

  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setOrders(null)
  }
  const nextMonth = () => {
    if (isFuture) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setOrders(null)
  }

  const handleFetchAds = async () => {
    if (!conn) return
    setAdsFetching(true)
    try {
      const token = await getValidToken()
      if (!token) { showToast('Token ML expirado', 'error'); return }
      const pad = (n) => String(n).padStart(2, '0')
      const dateFrom = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const dateTo   = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      const result = await fetchAdsSpend(conn.user_id, token, dateFrom, dateTo)
      setAdsSpend(result.total)
      setAdsSource(result.source)
      if (result.source === 'api' && result.total != null) {
        showToast(`Ads importado: ${fmtARS(result.total)}`, 'success')
      } else {
        showToast('ML Ads no disponible para esta cuenta — ingresá el monto manualmente', 'info')
      }
    } catch (err) {
      showToast(`Error ads: ${err.message}`, 'error')
    } finally {
      setAdsFetching(false)
    }
  }

  const fetchData = async () => {
    if (!conn) return
    setLoading(true)
    setError(null)
    try {
      const token = await getValidToken()
      if (!token) throw new Error('Token expirado — reconectá tu cuenta ML')
      const { from, to } = getMonthRange(year, month)
      const data = await fetchOrders(conn.user_id, token, from, to)
      setOrders(data)
    } catch (err) {
      setError(err.message)
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Build P&L table from orders + catalog
  const { rows, totals } = useMemo(() => {
    if (!orders) return { rows: [], totals: null }

    // Aggregate by item.id
    const map = new Map()
    for (const order of orders) {
      for (const oi of (order.order_items || [])) {
        const id = oi.item?.id
        if (!id) continue
        const qty = oi.quantity || 0
        const unitPrice = oi.unit_price || 0
        if (!map.has(id)) {
          map.set(id, { itemId: id, title: oi.item?.title || id, qty: 0, revenue: 0 })
        }
        const r = map.get(id)
        r.qty += qty
        r.revenue += unitPrice * qty
      }
    }

    // Enrich with catalog data
    const rows = []
    for (const [itemId, agg] of map.entries()) {
      const prod = productos.find(p => p.mlItemId === itemId)
      const costo = prod?.costoUnitARS ? prod.costoUnitARS * agg.qty : null
      const ganancia = costo != null ? agg.revenue - costo : null
      const margenPct = (ganancia != null && agg.revenue > 0) ? (ganancia / agg.revenue) * 100 : null
      rows.push({
        itemId,
        title: agg.title,
        qty: agg.qty,
        revenue: agg.revenue,
        costo,
        ganancia,
        margenPct,
        hasCosto: costo != null,
        productoId: prod?.id,
      })
    }

    rows.sort((a, b) => b.revenue - a.revenue)

    const totalRevenue  = rows.reduce((s, r) => s + r.revenue, 0)
    const totalCosto    = rows.filter(r => r.hasCosto).reduce((s, r) => s + (r.costo || 0), 0)
    const totalGanancia = rows.filter(r => r.hasCosto).reduce((s, r) => s + (r.ganancia || 0), 0)
    const margenBruto   = totalRevenue > 0 ? (totalGanancia / totalRevenue) * 100 : 0
    const sinCostoRevenue = rows.filter(r => !r.hasCosto).reduce((s, r) => s + r.revenue, 0)

    const gastosFijosActivos = gastosFijos.filter(g => g.activo)
    const totalGastosFijos   = gastosFijosActivos.reduce((s, g) => s + g.monto, 0)
    const gananciaOperativa  = totalGanancia - totalGastosFijos

    return {
      rows,
      totals: {
        totalRevenue, totalCosto, totalGanancia, margenBruto,
        sinCostoRevenue, totalGastosFijos, gananciaOperativa,
        gastosFijosActivos, numOrders: orders.length,
        numItems: rows.length, numSinCosto: rows.filter(r => !r.hasCosto).length,
      },
    }
  }, [orders, productos, gastosFijos])

  // Totals con ads
  const totalConAds = (totals && effectiveAds != null)
    ? { ...totals, totalAds: effectiveAds, gananciaNeta: totals.gananciaOperativa - effectiveAds }
    : totals

  if (!conn) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '60px auto' }}>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">P&L Mensual requiere ML conectado</div>
            <div className="empty-state-text">
              Conectá tu cuenta de Mercado Libre para importar las órdenes del mes y calcular tu ganancia real.
            </div>
            <a href={MELI_AUTH_URL} style={{
              marginTop: 20, display: 'inline-block',
              background: 'var(--brand)', color: '#fff',
              padding: '10px 24px', borderRadius: 'var(--radius)',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              Conectar con MercadoLibre →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">P&L Mensual</h1>
          <p className="page-subtitle">Ganancia real basada en órdenes de ML · Costos del catálogo</p>
        </div>
      </div>

      {/* Navegador de mes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn-sm" onClick={prevMonth}>← Anterior</button>
        <div style={{
          flex: 1, maxWidth: 280, textAlign: 'center',
          fontWeight: 700, fontSize: 17, color: 'var(--ink)',
          background: 'var(--bg-card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', padding: '8px 16px',
        }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button className="btn-sm" onClick={nextMonth} disabled={isFuture}>Siguiente →</button>
        <button className="btn-sm primary" onClick={fetchData} disabled={loading} style={{ minWidth: 120 }}>
          {loading ? '⟳ Cargando…' : orders === null ? '📊 Cargar P&L' : '🔄 Recargar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 16px', background: 'var(--neg-bg)', border: '1px solid var(--neg)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--neg)', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Estado inicial */}
      {orders === null && !loading && !error && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">Seleccioná el mes y cargá el P&L</div>
              <div className="empty-state-text">
                Hacé clic en "Cargar P&L" para traer las órdenes pagas de {MONTH_NAMES[month]} {year} desde ML y cruzarlas con tu catálogo.
              </div>
              <button className="btn-sm primary" style={{ marginTop: 16 }} onClick={fetchData}>
                📊 Cargar P&L de {MONTH_NAMES[month]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-text">Cargando órdenes de {MONTH_NAMES[month]}…</div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {orders !== null && !loading && totals && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard
              label="Revenue del mes"
              value={fmtARS(totals.totalRevenue)}
              sub={`${totals.numOrders} órdenes · ${totals.numItems} productos`}
              icon="💰"
            />
            <KpiCard
              label="Costo de ventas"
              value={fmtARS(totals.totalCosto)}
              sub={totals.numSinCosto > 0 ? `⚠ ${totals.numSinCosto} sin costo` : 'Todos los costos cargados'}
              color="var(--neg)"
              icon="📦"
            />
            <KpiCard
              label="Ganancia bruta"
              value={fmtARS(totals.totalGanancia)}
              sub={`Margen: ${fmt(totals.margenBruto, 1)}%`}
              color={totals.totalGanancia >= 0 ? 'var(--pos)' : 'var(--neg)'}
              icon="📊"
            />
            <KpiCard
              label="Gastos fijos"
              value={fmtARS(totals.totalGastosFijos)}
              sub={`${totals.gastosFijosActivos.length} ítems activos`}
              color="var(--warn)"
              icon="🏢"
            />
            <KpiCard
              label="Publicidad ML Ads"
              value={effectiveAds != null ? fmtARS(effectiveAds) : '—'}
              sub={adsSource === 'api' ? '✓ Importado de ML' : adsManualValue != null ? 'Ingresado manualmente' : 'No cargado'}
              color="var(--warn)"
              icon="📣"
            />
            <KpiCard
              label={totalConAds?.totalAds != null ? 'Ganancia neta' : 'Ganancia operativa'}
              value={fmtARS(totalConAds?.gananciaNeta ?? totals.gananciaOperativa)}
              sub={(totalConAds?.gananciaNeta ?? totals.gananciaOperativa) >= 0 ? 'Período rentable ✓' : 'Período en pérdida'}
              color={(totalConAds?.gananciaNeta ?? totals.gananciaOperativa) >= 0 ? 'var(--pos)' : 'var(--neg)'}
              icon="🎯"
            />
          </div>

          {/* Alertas */}
          {totals.numSinCosto > 0 && (
            <div style={{
              padding: '10px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn)',
              borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--warn)', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span>
                ⚠️ <strong>{totals.numSinCosto} publicación{totals.numSinCosto !== 1 ? 'es' : ''} sin costo</strong> cargado — el P&L subestima los costos.{' '}
                {fmtARS(totals.sinCostoRevenue)} de revenue sin calcular.
              </span>
              <button className="btn-sm" onClick={() => onNavigate?.('meli')}>Cargar costos →</button>
            </div>
          )}

          {totals.gastosFijosActivos.length === 0 && (
            <div style={{
              padding: '10px 16px', background: 'var(--bg-alt)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--ink-mute)', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span>Sin gastos fijos configurados — la ganancia operativa equivale a la ganancia bruta.</span>
              <button className="btn-sm" onClick={() => onNavigate?.('ajustes')}>Configurar gastos fijos →</button>
            </div>
          )}

          {/* Sin órdenes */}
          {orders.length === 0 && (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-title">Sin órdenes en {MONTH_NAMES[month]} {year}</div>
                  <div className="empty-state-text">No se registraron ventas pagas en este período.</div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla */}
          {rows.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Detalle por publicación</span>
                <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 400 }}>
                  {rows.length} publicación{rows.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="breakdown-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Publicación</th>
                      <th style={{ textAlign: 'right' }}>Unidades</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Costo</th>
                      <th style={{ textAlign: 'right' }}>Ganancia</th>
                      <th style={{ textAlign: 'right' }}>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.itemId}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                            {row.itemId}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {row.qty}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {fmtARS(row.revenue)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.hasCosto ? 'var(--neg)' : 'var(--ink-mute)' }}>
                          {row.hasCosto ? fmtARS(row.costo) : (
                            <span style={{ fontSize: 11, background: 'var(--warn-bg)', color: 'var(--warn)', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-sans)', fontWeight: 700 }}>
                              Sin costo
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                          color: row.ganancia == null ? 'var(--ink-mute)' : row.ganancia >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {row.ganancia != null ? fmtARS(row.ganancia) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <MargenBadge pct={row.margenPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                      <td style={{ paddingTop: 10 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', paddingTop: 10 }}>
                        {rows.reduce((s, r) => s + r.qty, 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', paddingTop: 10 }}>
                        {fmtARS(totals.totalRevenue)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neg)', paddingTop: 10 }}>
                        {fmtARS(totals.totalCosto)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: totals.totalGanancia >= 0 ? 'var(--pos)' : 'var(--neg)', paddingTop: 10 }}>
                        {fmtARS(totals.totalGanancia)}
                      </td>
                      <td style={{ textAlign: 'right', paddingTop: 10 }}>
                        <MargenBadge pct={totals.margenBruto} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Gastos fijos + Ads breakdown */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">Waterfall de rentabilidad</div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Ganancia bruta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-mute)' }}>Ganancia bruta</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: totals.totalGanancia >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtARS(totals.totalGanancia)}</span>
              </div>

              {/* Gastos fijos */}
              {totals.gastosFijosActivos.length > 0 && (
                <>
                  {totals.gastosFijosActivos.map(g => (
                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingLeft: 12 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>− {g.nombre}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--warn)', fontWeight: 600 }}>−{fmtARS(g.monto)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>Ganancia operativa</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: totals.gananciaOperativa >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtARS(totals.gananciaOperativa)}</span>
                  </div>
                </>
              )}

              {/* ML Ads */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>📣 Publicidad ML Ads</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {adsSource === 'api' && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--pos-bg)', color: 'var(--pos)', padding: '2px 7px', borderRadius: 99 }}>✓ API ML</span>
                    )}
                    <button className="btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={handleFetchAds} disabled={adsFetching}>
                      {adsFetching ? '⟳' : '🔄 Importar de ML'}
                    </button>
                  </div>
                </div>

                {adsSource === 'no_permission' && (
                  <p className="form-hint" style={{ color: 'var(--warn)' }}>
                    ⚠ Tu cuenta no tiene el permiso de Product Ads habilitado en la app. Ingresá el monto manualmente.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="form-input mono"
                    type="number"
                    min="0"
                    placeholder="Ingresá gasto en ads del mes…"
                    value={adsManualInput}
                    onChange={e => setAdsManualInput(e.target.value)}
                    onBlur={() => saveManualAds(adsManualInput)}
                    style={{ flex: 1, fontSize: 13 }}
                    disabled={adsSource === 'api' && adsSpend != null}
                  />
                  {adsSource !== 'api' && adsManualInput && (
                    <button className="btn-sm" onClick={() => { setAdsManualInput(''); saveManualAds('') }}>✕</button>
                  )}
                </div>

                {effectiveAds != null && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-mute)', paddingLeft: 12 }}>− Gasto en publicidad</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--warn)', fontWeight: 600 }}>−{fmtARS(effectiveAds)}</span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: totalConAds.gananciaNeta >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)',
                      border: `1px solid ${totalConAds.gananciaNeta >= 0 ? 'var(--pos)' : 'var(--neg)'}`,
                      borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 4,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>🎯 Ganancia neta</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: totalConAds.gananciaNeta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                        {fmtARS(totalConAds.gananciaNeta)}
                      </span>
                    </div>
                  </>
                )}

                {effectiveAds == null && totals.gastosFijosActivos.length > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: totals.gananciaOperativa >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)',
                    border: `1px solid ${totals.gananciaOperativa >= 0 ? 'var(--pos)' : 'var(--neg)'}`,
                    borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 4,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>🎯 Ganancia operativa</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: totals.gananciaOperativa >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {fmtARS(totals.gananciaOperativa)}
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
