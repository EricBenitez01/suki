import { useState, useMemo } from 'react'
import Header from './components/Header.jsx'
import InputPanel from './components/InputPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import HistorialPanel, { saveSimulacion } from './components/HistorialPanel.jsx'
import { calcularComparativa, DEFAULTS } from './lib/calculations.js'

const initialValues = {
  producto: '',
  fob: '',
  fobUnit: '',
  unidades: '',
  pesoKg: '',
  bultos: '',
  largoCm: '',
  anchoCm: '',
  altoCm: '',
  ncm: '',
  di: '',
  tc: DEFAULTS.tc,
  seguroPctAereo: DEFAULTS.seguroPctAereo,
  seguroPctMaritimo: DEFAULTS.seguroPctMaritimo,
  tasaEstadisticaPct: DEFAULTS.tasaEstadisticaPct,
  ivaPct: DEFAULTS.ivaPct,
  ivaAdicionalPct: DEFAULTS.ivaAdicionalPct,
  gananciasPct: DEFAULTS.gananciasPct,
  iibbPct: DEFAULTS.iibbPct,
  despachantePct: DEFAULTS.despachantePct,
  despachanteMín: DEFAULTS.despachanteMín,
  gastosOperativos: DEFAULTS.gastosOperativos,
  digitalizacion: DEFAULTS.digitalizacion,
  sim: DEFAULTS.sim,
  handlingAereo: DEFAULTS.handlingAereo,
  depositoFiscal: DEFAULTS.depositoFiscal,
  recargIMOFlete: DEFAULTS.recargIMOFlete,
  recargIMODeposito: DEFAULTS.recargIMODeposito,
  handlingMaritimo: DEFAULTS.handlingMaritimo,
  fleteAereoKgUSD: DEFAULTS.fleteAereoKgUSD,
  fleteAereoModo: 'calculado',
  fleteAereoCotizacion: '',
  fleteMarItimoWMRate: DEFAULTS.fleteMarItimoWMRate,
}

export default function App() {
  const [view, setView] = useState('cotizacion')
  const [values, setValues] = useState(initialValues)
  const [savedFlash, setSavedFlash] = useState(false)

  const handleChange = (newValues) => {
    const prev = values
    if (newValues.fob !== prev.fob && newValues.unidades) {
      newValues = { ...newValues, fobUnit: newValues.fob / newValues.unidades }
    } else if (newValues.fobUnit !== prev.fobUnit && newValues.unidades) {
      newValues = { ...newValues, fob: newValues.fobUnit * newValues.unidades }
    } else if (newValues.unidades !== prev.unidades && newValues.fob) {
      newValues = { ...newValues, fobUnit: newValues.fob / newValues.unidades }
    }
    setValues(newValues)
  }

  const results = useMemo(() => {
    const { fob, unidades, pesoKg, di } = values
    if (!fob || !unidades || !pesoKg || di === '') return null
    return calcularComparativa(values)
  }, [values])

  const handleSave = () => {
    if (!results) return
    saveSimulacion(values, results)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const handleRestore = (sim) => {
    setValues(sim.inputs)
    setView('cotizacion')
    window.scrollTo(0, 0)
  }

  return (
    <div className="app-shell">
      <Header view={view} onChangeView={setView} />
      <main className="app-main">

        {view === 'historial' && (
          <HistorialPanel onRestore={handleRestore} />
        )}

        {view === 'cotizacion' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Calculadora de importación</h1>
                <p className="page-subtitle">
                  Flete aéreo vs marítimo · Impuestos aduaneros · Pricing Mercado Libre
                </p>
              </div>
            </div>
            <div className="layout-cols">
              <div className="sidebar-sticky">
                <InputPanel values={values} onChange={handleChange} />
              </div>
              <div className="results-stack">
                <ResultsPanel
                  results={results}
                  producto={values.producto}
                  onSave={handleSave}
                  savedFlash={savedFlash}
                />
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  )
}
