export default function Header({ isDark, onToggleDark, profile, onSignOut, onToggleNav }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <button className="nav-hamburger" onClick={onToggleNav} aria-label="Menú">☰</button>
        <div className="header-logo">K</div>
        <span className="header-wordmark">Kyrax Technology</span>
        <div className="header-sep" />
        <span className="header-app">Suki</span>
      </div>
      <div className="header-right">
        <button className="dark-toggle" onClick={onToggleDark} title={isDark ? 'Modo claro' : 'Modo oscuro'}>
          {isDark ? '☀️' : '🌙'}
        </button>
        {profile && (
          <div className="header-user">
            <span className="header-user-name">{profile.nombre}</span>
            <span className="header-user-role">{profile.role}</span>
            <button className="btn-sm" style={{ padding: '3px 10px', fontSize: 11 }} onClick={onSignOut} title="Cerrar sesión">
              Salir
            </button>
          </div>
        )}
        <span className="header-version">v0.4.0</span>
      </div>
    </header>
  )
}
