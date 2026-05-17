import { useState } from 'react'
import { fmtUSD, fmtARS, fmt } from '../lib/calculations.js'

const STORAGE_KEY = 'suki_simulaciones'

export function loadSimulaciones() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}

export function saveSimulacion(inputs, results) {
  const ganador = results.aereo.totalUSD <= results.maritimo.totalUSD ? 'aereo' : 'maritimo'
  const sim = {
    id: Date.now(),
    nombre: (inputs.producto || 'Sin nombre').trim(),
    fecha: new Date().toISOString(),
    inputs: { ...inputs },
    ganador,
    aereo: {
      totalUSD: results.aereo.totalUSD,
      totalARS: results.aereo.totalARS,
      costoUnitUSD: results.aereo.costoUnitUSD,
      costoUnitARS: results.aereo.costoUnitARS,
    },
    maritimo: {
      totalUSD: results.maritimo.totalUSD,
      totalARS: results.maritimo.totalARS,
      costoUnitUSD: results.maritimo.costoUnitUSD,
      costoUnitARS: results.maritimo.costoUnitARS,
    },
  }
  const prev = loadSimulaciones()
  const updated = [sim, ...prev]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

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
          {sim.inputs.unidades ? ` · ${fmt(sim.inputs.unidades, 0)} uds` : ''}
          {sim.inputs.fob ? ` · FOB ${fmtUSD(sim.inputs.fob)}` : ''}
          {sim.inputs.di !== '' ? ` · DI ${sim.inputs.di}%` : ''}
        </div>
      </div>

      <div className="sim-card-body">
        <div className={`sim-mode-row aereo${sim.ganador === 'aereo' ? '' : ''}`}>
          <span className="label">✈ Aéreo</span>
          <span className="val-usd">{fmtUSD(sim.aereo.totalUSD)}</span>
          <span className="val-unit">{fmtUSD(sim.aereo.costoUnitUSD)}/ud</span>
        </div>
        <div className={`sim-mode-row maritimo`}>
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
        <button className="btn-sm danger" onClick={() => onDelete(sim.id)}>
          🗑
        </button>
      </div>
    </div>
  )
}

export default function HistorialPanel({ onRestore }) {
  const [sims, setSims] = useState(loadSimulaciones)
  const [filtro, setFiltro] = useState('')

  const deleteSim = (id) => {
    const updated = sims.filter(s => s.id !== id)
    setSims(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const clearAll = () => {
    if (!confirm('¿Eliminar todas las simulaciones guardadas?')) return
    setSims([])
    localStorage.removeItem(STORAGE_KEY)
  }

  const filtered = sims.filter(s =>
    s.nombre.toLowerCase().includes(filtro.toLowerCase())
  )

  if (sims.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '60px auto' }}>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Sin simulaciones guardadas</div>
            <div className="empty-state-text">
              Hacé una cotización y presioná <strong>Guardar simulación</strong> para que aparezca acá.
              Podés volver a verla en cualquier momento.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de simulaciones</h1>
          <p className="page-subtitle">{sims.length} cotización{sims.length !== 1 ? 'es' : ''} guardada{sims.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="form-input"
            type="text"
            placeholder="Buscar por producto…"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ width: 220 }}
          />
          <button className="btn-sm danger" onClick={clearAll}>Limpiar todo</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-mute" style={{ textAlign: 'center', padding: '40px 0' }}>
          Ninguna simulación coincide con "{filtro}"
        </p>
      ) : (
        <div className="sim-grid">
          {filtered.map(sim => (
            <SimCard key={sim.id} sim={sim} onRestore={onRestore} onDelete={deleteSim} />
          ))}
        </div>
      )}
    </div>
  )
}
