import { fmt } from '../lib/calculations.js'

const MODULES = [
  {
    id: 'cotizador',
    icon: '⚖️',
    label: 'Cotizador de flete',
    desc: 'Comparativa aéreo vs marítimo · Impuestos aduaneros · Costo landed',
  },
  {
    id: 'pricing',
    icon: '💰',
    label: 'Pricing ML',
    desc: 'Calculadora de precios · Márgenes · Punto de equilibrio',
  },
  {
    id: 'importaciones',
    icon: '📦',
    label: 'Importaciones',
    desc: 'Proyectos de importación · Múltiples productos · Proveedores',
  },
  {
    id: 'historial',
    icon: '📋',
    label: 'Historial',
    desc: 'Simulaciones guardadas · Recuperar datos · Comparativas',
  },
]

const LOGO_PATH = "M96.8933 25.1082L104.802 67.7794L114.084 72.7742C117.498 68.3179 108.08 17.9527 134.546 24.3006C133.73 42.1186 136.185 60.213 140.007 77.6343C140.966 81.956 141.102 96.8126 148.875 93.0294C156.654 89.2461 160.34 36.1816 163.203 24.3006C175.62 11.3355 178.762 69.2602 181.625 72.7742L195.674 26.0576L294.062 0C301.834 8.50874 267.18 68.1833 263.358 80.8791C257.353 100.589 258.985 128.545 248.622 147.178C234.701 172.166 183.672 196.459 155.144 198.358C152.145 181.886 157.463 172.166 163.332 157.854H134.818C138.368 172.569 151.73 181.617 142.591 197.954C132.492 205.117 67.8144 170.409 58.5318 160.426C37.1109 137.472 42.7005 107.362 34.6561 80.8932C30.8342 68.0628 -0.277256 12.0298 0.00186665 6.09285C5.04755 -0.524275 5.31952 0.552601 12.2833 1.76409C38.2059 6.48959 68.4944 24.1801 97.1581 25.1224H96.8862L96.8933 25.1082ZM134.553 145.548C129.508 115.573 91.7045 104.5 65.1019 101.127C58.1382 123.536 126.101 153.377 134.553 145.548ZM232.669 101.127C227.208 95.594 155.158 122.459 163.21 145.548C172.078 154.057 239.081 122.728 232.669 101.127Z"

function KyraxLogo({ isDark, width = 96 }) {
  const height = Math.round(width * 199 / 296)
  if (isDark) {
    return (
      <svg width={width} height={height} viewBox="0 0 296 199" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={LOGO_PATH} fill="#E6E8FF" />
      </svg>
    )
  }
  return (
    <svg width={width} height={height} viewBox="0 0 296 199" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="kyrax-grad-inicio" x1="147.597" y1="0" x2="147.597" y2="198.92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0C0819" />
          <stop offset="1" stopColor="#4601FA" />
        </linearGradient>
      </defs>
      <path d={LOGO_PATH} fill="url(#kyrax-grad-inicio)" />
    </svg>
  )
}

export default function InicioPanel({ onNavigate, tcRates, isDark }) {
  return (
    <div className="inicio-panel">
      <div className="inicio-hero">
        <div className="inicio-logo-wrap">
          <KyraxLogo isDark={isDark} width={96} />
        </div>

        <h1 className="inicio-tagline">La plataforma de importaciones de Kyrax</h1>
        <p className="inicio-frase">Cada importación, una decisión más inteligente.</p>

        {tcRates && (
          <div className="inicio-tc-badges">
            {tcRates.oficial && (
              <span className="tc-badge oficial">
                💵 Oficial · $ {fmt(tcRates.oficial, 2)}
              </span>
            )}
            {tcRates.blue && (
              <span className="tc-badge blue">
                🔵 Blue · $ {fmt(tcRates.blue, 2)}
              </span>
            )}
            {tcRates.mep && (
              <span className="tc-badge mep">
                📈 MEP · $ {fmt(tcRates.mep, 2)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="inicio-grid">
        {MODULES.map(mod => (
          <button
            key={mod.id}
            className="inicio-card"
            onClick={() => onNavigate(mod.id)}
          >
            <span className="inicio-card-icon">{mod.icon}</span>
            <div>
              <div className="inicio-card-title">{mod.label}</div>
              <div className="inicio-card-desc">{mod.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
