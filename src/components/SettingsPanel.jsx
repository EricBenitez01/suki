import { useState, useEffect } from 'react'
import { getStats, exportarTodo, importarTodo } from '../lib/db.js'
import { getMeliConnection, clearMeliConnection, getCachedItems } from '../lib/meli.js'
import { fmtARS } from '../lib/calculations.js'

const GF_KEY = 'suki_gastos_fijos'
function loadGastosFijos() { try { return JSON.parse(localStorage.getItem(GF_KEY)) || [] } catch { return [] } }
function saveGastosFijos(list) { localStorage.setItem(GF_KEY, JSON.stringify(list)) }

function GastosFijosSection() {
  const [gastos, setGastos] = useState(loadGastosFijos)
  const [newNombre, setNewNombre] = useState('')
  const [newMonto, setNewMonto] = useState('')

  const save = (list) => { setGastos(list); saveGastosFijos(list) }

  const add = () => {
    const monto = parseFloat(newMonto.replace(/\./g, '').replace(',', '.'))
    if (!newNombre.trim() || !monto) return
    save([...gastos, { id: Date.now(), nombre: newNombre.trim(), monto, activo: true }])
    setNewNombre(''); setNewMonto('')
  }

  const toggle = (id) => save(gastos.map(g => g.id === id ? { ...g, activo: !g.activo } : g))
  const remove = (id) => save(gastos.filter(g => g.id !== id))

  const total = gastos.filter(g => g.activo).reduce((s, g) => s + g.monto, 0)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Gastos fijos mensuales</span>
        {total > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--neg)' }}>
            Total: {fmtARS(total)}/mes
          </span>
        )}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="form-hint">Estos gastos se descuentan del P&L Mensual para calcular tu ganancia operativa real.</p>

        {gastos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Sin gastos fijos cargados.</p>
        )}

        {gastos.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <input
              type="checkbox" checked={g.activo}
              onChange={() => toggle(g.id)}
              style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: g.activo ? 'var(--ink)' : 'var(--ink-mute)' }}>
              {g.nombre}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: g.activo ? 'var(--neg)' : 'var(--ink-mute)', fontWeight: 700 }}>
              {fmtARS(g.monto)}
            </span>
            <button onClick={() => remove(g.id)} className="btn-sm danger" style={{ padding: '3px 8px', fontSize: 11 }}>✕</button>
          </div>
        ))}

        {/* Agregar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            className="form-input" placeholder="Ej: Alquiler, Empleados…"
            value={newNombre} onChange={e => setNewNombre(e.target.value)}
            style={{ flex: 2, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <input
            className="form-input" placeholder="Monto $"
            value={newMonto} onChange={e => setNewMonto(e.target.value)}
            style={{ flex: 1, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button className="btn-sm primary" onClick={add} disabled={!newNombre.trim() || !newMonto}>
            + Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPanel({ profile }) {
  const [stats, setStats] = useState({ simulaciones: 0, productos: 0, importaciones: 0 })
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [meliConn, setMeliConn] = useState(getMeliConnection)

  useEffect(() => {
    getStats().then(setStats)
  }, [])

  const flash = (text, type = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const handleExport = async () => {
    try {
      await exportarTodo()
      flash('Backup descargado correctamente.')
    } catch {
      flash('Error al exportar.', 'err')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await importarTodo(file)
      const s = await getStats()
      setStats(s)
      flash('Datos restaurados correctamente.')
    } catch (err) {
      flash(`Error al importar: ${err.message}`, 'err')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-subtitle">Configuración y gestión de datos</p>
        </div>
      </div>

      {/* MercadoLibre */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">MercadoLibre</div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meliConn ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Conectado · Usuario #{meliConn.user_id}</span>
              </div>
              {(() => { const c = getCachedItems(); return c ? (
                <p className="form-hint">Caché: {c.items?.length ?? 0} publicaciones · última sync {new Date(c.synced_at).toLocaleString('es-AR')}</p>
              ) : null })()}
              <p className="form-hint" style={{ color: 'var(--ink-mute)' }}>Acceso de solo lectura — Suki no modifica tus publicaciones.</p>
              <button className="btn-sm danger" style={{ alignSelf: 'flex-start' }} onClick={() => { clearMeliConnection(); setMeliConn(null) }}>
                Desconectar ML
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-mute)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>No conectado</span>
              </div>
              <p className="form-hint">Conectá tu cuenta para ver tus publicaciones desde el módulo ML Publicaciones.</p>
            </>
          )}
        </div>
      </div>

      {/* Perfil */}
      {profile && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Tu cuenta</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Nombre</div>
                <div style={{ fontWeight: 600 }}>{profile.nombre}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Rol</div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                    background: profile.role === 'admin' ? 'var(--brand-light)' : 'var(--bg-alt)',
                    color: profile.role === 'admin' ? 'var(--brand)' : 'var(--ink-soft)',
                    border: '1px solid var(--line)',
                  }}>
                    {profile.role}
                  </span>
                </div>
              </div>
            </div>
            {profile.role === 'admin' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Código de equipo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-alt)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.org_id}
                  </code>
                  <button className="btn-sm" onClick={() => { navigator.clipboard?.writeText(profile.org_id); flash('Código copiado.') }}>
                    Copiar
                  </button>
                </div>
                <p className="form-hint">Compartí este código al crear la cuenta de un nuevo miembro del equipo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <GastosFijosSection />

      <div className="card">
        <div className="card-header">Datos almacenados</div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div className="settings-stats">
            <div className="settings-stat">
              <span className="settings-stat-val">{stats.simulaciones}</span>
              <span className="settings-stat-label">Simulaciones</span>
            </div>
            <div className="settings-stat">
              <span className="settings-stat-val">{stats.importaciones}</span>
              <span className="settings-stat-label">Importaciones</span>
            </div>
            <div className="settings-stat">
              <span className="settings-stat-val">{stats.productos}</span>
              <span className="settings-stat-label">Productos</span>
            </div>
          </div>

          {msg && <div className={`settings-msg ${msg.type}`}>{msg.text}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn-sm primary" style={{ alignSelf: 'flex-start' }} onClick={handleExport}>
              📤 Exportar todo
            </button>
            <p className="form-hint">Descarga un JSON con todas tus simulaciones, importaciones y productos.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="btn-sm" style={{ alignSelf: 'flex-start', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              📥 {importing ? 'Importando...' : 'Importar backup'}
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
            </label>
            <p className="form-hint">Restaura datos desde un JSON exportado previamente.</p>
          </div>

        </div>
      </div>
    </div>
  )
}
