import { useState, useMemo, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider, useToast } from './contexts/ToastContext.jsx'
import Header from './components/Header.jsx'
import SideNav from './components/SideNav.jsx'
import InicioPanel from './components/InicioPanel.jsx'
import InputPanel from './components/InputPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import HistorialPanel from './components/HistorialPanel.jsx'
import SaveModal from './components/SaveModal.jsx'
import PricingPanel from './components/PricingPanel.jsx'
import ImportacionesPanel from './components/ImportacionesPanel.jsx'
import CatalogoPanel from './components/CatalogoPanel.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import MLPublicacionesPanel from './components/MLPublicacionesPanel.jsx'
import DashboardSaludPanel from './components/DashboardSaludPanel.jsx'
import PLMensualPanel from './components/PLMensualPanel.jsx'
import LoginPage from './components/LoginPage.jsx'
import { calcularComparativa, DEFAULTS } from './lib/calculations.js'
import { saveSimulacion, addProducto } from './lib/db.js'
import { saveMeliConnection } from './lib/meli.js'

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

function AppInner() {
  const { session, profile, loading, signOut } = useAuth()
  const showToast = useToast()
  const [view, setView] = useState('inicio')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [values, setValues] = useState(initialValues)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [tcRates, setTcRates] = useState(null)
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('suki_dark') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try { localStorage.setItem('suki_dark', isDark) } catch {}
  }, [isDark])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('meli_ok') === '1') {
      const at = params.get('meli_at')
      const rt = params.get('meli_rt')
      const uid = params.get('meli_uid')
      const exp = params.get('meli_exp')
      if (at && uid) {
        saveMeliConnection({ access_token: at, refresh_token: rt, user_id: uid, expires_at: Number(exp) })
        showToast('Cuenta de MercadoLibre conectada ✓', 'success')
        setView('meli')
      }
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('meli_error')) {
      showToast(`Error ML: ${params.get('meli_error')}`, 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    fetch('https://dolarapi.com/v1/dolares')
      .then(r => r.json())
      .then(data => {
        const oficial = data.find(d => d.casa === 'oficial')
        const blue = data.find(d => d.casa === 'blue')
        const mep = data.find(d => d.casa === 'bolsa')
        const rates = { oficial: oficial?.venta ?? null, blue: blue?.venta ?? null, mep: mep?.venta ?? null }
        setTcRates(rates)
        if (rates.oficial) setValues(v => ({ ...v, tc: rates.oficial }))
      })
      .catch(() => {})
  }, [])

  const handleChange = (newValues) => {
    const prev = values
    if (newValues.fob !== prev.fob && newValues.unidades) {
      newValues = { ...newValues, fobUnit: newValues.fob / newValues.unidades }
    } else if (newValues.fobUnit !== prev.fobUnit && newValues.unidades) {
      newValues = { ...newValues, fob: newValues.fobUnit * newValues.unidades }
    } else if (newValues.unidades !== prev.unidades && newValues.fobUnit) {
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

  const handleModalSave = async ({ titulo, notas, catalogo }) => {
    const sim = await saveSimulacion(values, results, titulo, notas)
    if (catalogo) {
      const base = catalogo.modo === 'aereo' ? results.aereo : results.maritimo
      await addProducto({
        nombre: (titulo || values.producto || 'Sin nombre').trim(),
        sku: catalogo.sku || '',
        mlPct: catalogo.mlPct, adsPct: catalogo.adsPct,
        ivaPct: catalogo.ivaPct, iibbPct: catalogo.iibbPct, otrosPct: 0,
        precioActual: null,
        costoUnitARS: base.costoUnitARS, costoUnitUSD: base.costoUnitUSD,
        costoSource: 'simulacion', simulacionId: sim.id,
        importacionId: null, importacionProductoId: null,
      })
    }
    setShowModal(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
    showToast(catalogo ? 'Simulación guardada y agregada al catálogo ✓' : 'Simulación guardada ✓', 'success')
  }

  const handleRestore = (sim) => {
    setValues(sim.inputs)
    setView('cotizador')
    window.scrollTo(0, 0)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: 'var(--ink-mute)' }}>
        Cargando…
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <div className="app-shell">
      {showModal && (
        <SaveModal
          results={results}
          defaultTitle={values.producto || ''}
          onSave={handleModalSave}
          onClose={() => setShowModal(false)}
        />
      )}
      <Header isDark={isDark} onToggleDark={() => setIsDark(d => !d)} profile={profile} onSignOut={signOut} onToggleNav={() => setMobileNavOpen(v => !v)} />
      <div className="app-body">
        <SideNav view={view} onChangeView={setView} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="app-content">

          {view === 'inicio' && (
            <InicioPanel onNavigate={setView} tcRates={tcRates} isDark={isDark} />
          )}

          {view === 'dashboard' && <DashboardSaludPanel onNavigate={setView} />}
          {view === 'plmensual' && <PLMensualPanel onNavigate={setView} />}

          {view === 'cotizador' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Cotizador de flete</h1>
                  <p className="page-subtitle">Comparativa aéreo vs marítimo · Impuestos aduaneros · Costo landed</p>
                </div>
              </div>
              <div className="layout-cols">
                <div className="sidebar-sticky">
                  <InputPanel values={values} onChange={handleChange} />
                </div>
                <div className="results-stack">
                  <ResultsPanel results={results} inputs={values} producto={values.producto} onSave={() => results && setShowModal(true)} savedFlash={savedFlash} />
                </div>
              </div>
            </>
          )}

          {view === 'pricing' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Pricing ML</h1>
                  <p className="page-subtitle">
                    Calculadora de precios para Mercado Libre · Márgenes · Punto de equilibrio
                    {results && <span className="page-subtitle-badge">· Costo del cotizador disponible</span>}
                  </p>
                </div>
              </div>
              <div style={{ maxWidth: 900 }}>
                <PricingPanel aereo={results?.aereo} maritimo={results?.maritimo} />
              </div>
            </>
          )}

          {view === 'catalogo' && <CatalogoPanel onNavigate={setView} />}
          {view === 'importaciones' && <ImportacionesPanel />}
          {view === 'meli' && <MLPublicacionesPanel />}
          {view === 'historial' && <HistorialPanel onRestore={handleRestore} />}
          {view === 'ajustes' && <SettingsPanel profile={profile} />}

        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  )
}
