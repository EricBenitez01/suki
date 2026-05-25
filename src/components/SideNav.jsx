const NAV_TOP = [
  { id: 'inicio', icon: '🏠', label: 'Inicio' },
]

const NAV_ANALYSIS = [
  { id: 'dashboard', icon: '📊', label: 'Salud del negocio' },
  { id: 'plmensual', icon: '📈', label: 'P&L Mensual' },
]

const NAV_ITEMS = [
  { id: 'cotizador', icon: '⚖️', label: 'Cotizador de flete' },
  { id: 'pricing', icon: '💰', label: 'Pricing ML' },
  { id: 'catalogo', icon: '🛍️', label: 'Catálogo' },
  { id: 'importaciones', icon: '📦', label: 'Importaciones' },
  { id: 'meli', icon: '🛒', label: 'ML Publicaciones' },
]

const NAV_BOTTOM = [
  { id: 'historial', icon: '📋', label: 'Historial' },
]

const NAV_FOOTER = [
  { id: 'ajustes', icon: '⚙️', label: 'Ajustes' },
]

function NavBtn({ item, active, onChangeView }) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => !item.soon && onChangeView(item.id)}
      disabled={item.soon}
      title={item.soon ? 'Próximamente' : item.label}
    >
      <span className="nav-item-icon">{item.icon}</span>
      <span className="nav-item-label">{item.label}</span>
      {item.soon && <span className="nav-item-badge">soon</span>}
    </button>
  )
}

export default function SideNav({ view, onChangeView, isOpen, onClose }) {
  const handleNav = (id) => {
    onChangeView(id)
    onClose?.()
  }

  return (
    <>
      <div className={`nav-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <nav className={`side-nav ${isOpen ? 'mobile-open' : ''}`}>
        {NAV_TOP.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onChangeView={handleNav} />
        ))}

        <div className="nav-sep" />
        <div className="nav-section-label">Análisis</div>
        {NAV_ANALYSIS.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onChangeView={handleNav} />
        ))}

        <div className="nav-sep" />
        <div className="nav-section-label">Herramientas</div>

        {NAV_ITEMS.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onChangeView={handleNav} />
        ))}

        <div className="nav-sep" />

        {NAV_BOTTOM.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onChangeView={handleNav} />
        ))}

        <div style={{ marginTop: 'auto' }} />
        <div className="nav-sep" />

        {NAV_FOOTER.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onChangeView={handleNav} />
        ))}
      </nav>
    </>
  )
}
