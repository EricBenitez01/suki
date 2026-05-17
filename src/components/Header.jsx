export default function Header({ view, onChangeView }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo">K</div>
        <span className="header-wordmark">Kyrax Technology</span>
        <div className="header-sep" />
        <span className="header-app">Suki</span>
      </div>
      <div className="header-right">
        <nav className="header-nav">
          <button
            className={view === 'cotizacion' ? 'active' : ''}
            onClick={() => onChangeView('cotizacion')}
          >
            Nueva cotización
          </button>
          <button
            className={view === 'historial' ? 'active' : ''}
            onClick={() => onChangeView('historial')}
          >
            📋 Historial
          </button>
        </nav>
        <span className="header-version">v0.2.0</span>
      </div>
    </header>
  )
}
