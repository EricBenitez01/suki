/**
 * Navega a una sección por el ID de la vista.
 * Hace click en el nav-item correspondiente y espera que cargue.
 */
export async function goTo(page, viewId) {
  await page.click(`.nav-item[title]`, { force: false }).catch(() => {})
  // Buscar por label del nav
  const labels = {
    inicio:        'Inicio',
    dashboard:     'Salud del negocio',
    plmensual:     'P&L Mensual',
    cotizador:     'Cotizador de flete',
    pricing:       'Pricing ML',
    catalogo:      'Catálogo',
    importaciones: 'Importaciones',
    meli:          'ML Publicaciones',
    historial:     'Historial',
    ajustes:       'Ajustes',
  }
  const label = labels[viewId]
  if (!label) throw new Error(`Vista desconocida: ${viewId}`)
  await page.click(`.nav-item:has(.nav-item-label:text-is("${label}"))`)
}

/** Espera que la app esté lista (sesión cargada, shell visible) */
export async function waitForApp(page) {
  await page.waitForSelector('.app-shell', { timeout: 20_000 })
}
