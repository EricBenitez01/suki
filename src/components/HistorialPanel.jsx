import { useState, useEffect } from 'react'
import { fmtUSD, fmtARS, fmt } from '../lib/calculations.js'
import * as db from '../lib/db.js'
import ConfirmModal from './ConfirmModal.jsx'
import { useToast } from '../contexts/ToastContext.jsx'

// Re-exports for backward compatibility con App.jsx
export const loadSimulaciones = db.loadSimulaciones
export const saveSimulacion = db.saveSimulacion

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SimCard({ sim, onRestore, onDelete }) {
  const ahorroDiff = Math.abs(sim.aereo.totalUSD - sim.maritimo.totalUSD)
  const ahorroMin = Math.min(sim.aereo.totalUSD, sim.maritimo.totalUSD)
  const ahorroPct = (ahorroDiff / ahorroMin * 100).toFixed(1)

  return (
    <div className="sim-card">
      <div className="sim-card-top">
        <div className={`sim-card-badge ${sim.ganador}`}>
          {sim.ganador === 'aereo' ? '✈ Aéreo conviene' : '🚢 Marítimo conviene'}
        </div>
        <div className="sim-card-title" title={sim.nombre}>{sim.nombre}</div>
        <div className="sim-card-meta">
          {formatFecha(sim.fecha)}
          {sim.inputs?.unidades ? ` · ${fmt(sim.inputs.unidades, 0)} uds` : ''}
          {sim.inputs?.fob ? ` · FOB ${fmtUSD(sim.inputs.fob)}` : ''}
          {sim.inputs?.di !== '' ? ` · DI ${sim.inputs.di}%` : ''}
        </div>
        {sim.notas && (
          <div className="sim-card-meta" style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 11, opacity: 0.8 }}>
            {sim.notas}
          </div>
        )}
      </div>

      <div className="sim-card-body">
        <div className="sim-mode-row aereo">
          <span className="label">✈ Aéreo</span>
          <span className="val-usd">{fmtUSD(sim.aereo.totalUSD)}</span>
          <span className="val-unit">{fmtUSD(sim.aereo.costoUnitUSD)}/ud</span>
        </div>
        <div className="sim-mode-row maritimo">
          <span className="label">🚢 Marítimo</span>
          <span className="val-usd">{fmtUSD(sim.maritimo.totalUSD)}</span>
          <span className="val-unit">{fmtUSD(sim.maritimo.costoUnitUSD)}/ud</span>
        </div>
        <div className="sim-saving">
          {sim.ganador === 'aereo' ? '✈' : '🚢'} Ahorro {fmtUSD(ahorroDiff)} vs alternativa ({ahorroPct}% menos)
        </div>
      </div>

      <div className="sim-card-footer">
        <button className="btn-sm primary" style={{ flex: 1 }} onClick={() => onRestore(sim)}>
          Restaurar cotización
        </button>
        <button className="btn-sm danger" onClick={() => onDelete(sim.id)}>🗑</button>
      </div>
    </div>
  )
}

export default function HistorialPanel({ onRestore }) {
  const showToast = useToast()
  const [sims, setSims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [sortDir, setSortDir] = useState('desc')
  const [confirmDelId, setConfirmDelId] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  useEffect(() => {
    db.loadSimulaciones().then(data => { setSims(data); setLoading(false) })
  }, [])

  const deleteSim = async (id) => {
    await db.deleteSimulacion(id)
    setSims(prev => prev.filter(s => s.id !== id))
    showToast('Simulación eliminada', 'success')
  }

  const clearAll = async () => {
    await db.clearSimulaciones()
    setSims([])
    showToast('Historial limpiado', 'success')
  }

  const filtered = sims
    .filter(s => s.nombre.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => sortDir === 'desc'
      ? new Date(b.fecha) - new Date(a.fecha)
      : new Date(a.fecha) - new Date(b.fecha)
    )

  return (
    <div>
      {confirmDelId != null && (
        <ConfirmModal
          title="Eliminar simulación"
          message="¿Eliminar esta simulación del historial? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { deleteSim(confirmDelId); setConfirmDelId(null) }}
          onCancel={() => setConfirmDelId(null)}
        />
      )}
      {confirmClearAll && (
        <ConfirmModal
          title="Limpiar historial"
          message="¿Eliminar todas las simulaciones guardadas? Esta acción no se puede deshacer."
          confirmLabel="Eliminar todo"
          danger
          onConfirm={() => { clearAll(); setConfirmClearAll(false) }}
          onCancel={() => setConfirmClearAll(false)}
        />
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de simulaciones</h1>
          <p className="page-subtitle">{sims.length} {sims.length !== 1 ? 'cotizaciones' : 'cotización'} guardada{sims.length !== 1 ? 's' : ''}</p>
        </div>
        {sims.length > 0 && (
          <div className="historial-toolbar">
            <input
              className="form-input"
              type="text"
              placeholder="Buscar por producto…"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
            <button
              className="btn-sm"
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              title="Cambiar orden"
            >
              {sortDir === 'desc' ? '↓ Recientes' : '↑ Antiguas'}
            </button>
            <button className="btn-sm danger" onClick={() => setConfirmClearAll(true)}>Limpiar</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-state" style={{ marginTop: 40 }}><div className="empty-state-text">Cargando simulaciones…</div></div>
      ) : sims.length === 0 ? (
        <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Sin simulaciones guardadas</div>
              <div className="empty-state-text">
                Hacé una cotización y presioná <strong>Guardar simulación</strong> para que aparezca acá.
              </div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-mute" style={{ textAlign: 'center', padding: '40px 0' }}>
          Ninguna simulación coincide con "{filtro}"
        </p>
      ) : (
        <div className="sim-grid">
          {filtered.map(sim => (
            <SimCard key={sim.id} sim={sim} onRestore={onRestore} onDelete={id => setConfirmDelId(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
