import { useState, useEffect } from 'react'
import { getStats, exportarTodo, importarTodo } from '../lib/db.js'

export default function SettingsPanel({ profile }) {
  const [stats, setStats] = useState({ simulaciones: 0, productos: 0, importaciones: 0 })
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

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
