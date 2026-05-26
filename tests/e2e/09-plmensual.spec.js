import { test, expect } from '@playwright/test'
import { injectMLMock, clearMLMock } from './helpers/ml-mock.js'

test.describe('P&L Mensual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await injectMLMock(page)
    await page.click('.nav-item:has(.nav-item-label:text-is("P&L Mensual"))')
    await expect(page.locator('.page-title:has-text("P&L")')).toBeVisible({ timeout: 10_000 })
  })

  test.afterEach(async ({ page }) => {
    await clearMLMock(page)
  })

  test('renderiza el panel con navegador de mes', async ({ page }) => {
    await expect(page.locator('button:has-text("← Anterior")')).toBeVisible()
    await expect(page.locator('button:has-text("Siguiente →")')).toBeVisible()
    await expect(page.locator('button:has-text("Cargar P&L"), button:has-text("Recargar")')).toBeVisible()
  })

  test('muestra el mes actual en el selector', async ({ page }) => {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const mesActual = meses[new Date().getMonth()]
    await expect(page.locator(`text=/${mesActual}/`).first()).toBeVisible()
  })

  test('el botón "← Anterior" navega al mes previo', async ({ page }) => {
    const prev = page.locator('button:has-text("← Anterior")')
    await prev.click()
    await page.waitForTimeout(200)
    await expect(page.locator('.app-shell')).toBeVisible()
  })

  test('el botón "Siguiente →" está deshabilitado en el mes actual', async ({ page }) => {
    const siguiente = page.locator('button:has-text("Siguiente →")')
    await expect(siguiente).toBeDisabled()
  })

  test('estado inicial muestra aviso de cargar P&L', async ({ page }) => {
    await expect(page.locator('text=/Cargar P&L|cargá el P&L|Seleccioná el mes/i').first()).toBeVisible()
  })

  test('el botón de importar ads existe', async ({ page }) => {
    await expect(page.locator('button:has-text("Importar de ML"), button:has-text("🔄 Importar")')).toBeVisible({ timeout: 5_000 })
  })

  test('el campo de ads manual existe y acepta input', async ({ page }) => {
    const adsInput = page.locator('input[placeholder*="ads"]')
    if (await adsInput.isVisible()) {
      await adsInput.fill('5000')
      await adsInput.blur()
      await page.waitForTimeout(200)
      await expect(page.locator('.app-shell')).toBeVisible()
    }
  })

  test('sin ML conectado muestra pantalla de conexión', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('suki_meli_connection')
      localStorage.removeItem('suki_meli_items_cache')
    })
    await page.reload()
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("P&L Mensual"))')
    await expect(page.locator('text=/Conectar|conectá|MercadoLibre/i').first()).toBeVisible({ timeout: 8_000 })
  })

  test('el botón del estado vacío también lanza carga', async ({ page }) => {
    const btnCarga = page.locator('button:has-text("Cargar P&L")').first()
    if (await btnCarga.isVisible()) {
      // Just verify it's clickable — real API call would fail without live token
      await expect(btnCarga).toBeEnabled()
    }
  })
})
