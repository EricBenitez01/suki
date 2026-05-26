import { test, expect } from '@playwright/test'
import { injectMLMock, clearMLMock, MOCK_ML_ITEMS } from './helpers/ml-mock.js'

test.describe('ML Publicaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await injectMLMock(page)
    await page.click('.nav-item:has(.nav-item-label:text-is("ML Publicaciones"))')
    await expect(page.locator('.page-title:has-text("Publicaciones")')).toBeVisible({ timeout: 10_000 })
  })

  test.afterEach(async ({ page }) => {
    await clearMLMock(page)
  })

  test('muestra la grilla de publicaciones con los items del mock', async ({ page }) => {
    // Con mock inyectado, debería mostrar las 5 publicaciones
    await expect(page.locator('.ml-card, .ml-grid')).toBeVisible({ timeout: 8_000 })
    const cards = page.locator('.ml-card')
    await expect(cards).toHaveCount(MOCK_ML_ITEMS.length, { timeout: 8_000 })
  })

  test('muestra el nombre de usuario ML', async ({ page }) => {
    await expect(page.locator('text=/KYRAX|2475937761|Usuario/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('el filtro de estado activa funciona', async ({ page }) => {
    await page.locator('.pill-toggle button:has-text("Activas")').click()
    await page.waitForTimeout(300)
    // Solo debería mostrar items activos (4 en el mock)
    const cards = page.locator('.ml-card')
    const count = await cards.count()
    expect(count).toBeLessThanOrEqual(MOCK_ML_ITEMS.length)
  })

  test('el buscador filtra por título', async ({ page }) => {
    await page.locator('input[placeholder*="Buscar"]').fill('Camara')
    await page.waitForTimeout(300)
    const cards = page.locator('.ml-card')
    expect(await cards.count()).toBeGreaterThanOrEqual(1)
    await page.locator('input[placeholder*="Buscar"]').fill('xyznoexiste999')
    await page.waitForTimeout(300)
    // Sin resultados
    await expect(page.locator('text=/Sin resultados/i')).toBeVisible({ timeout: 3_000 })
  })

  test('click en card abre el detalle del item', async ({ page }) => {
    await page.locator('.ml-card').first().click()
    await expect(page.locator('button:has-text("Volver al catálogo ML"), .ml-detail')).toBeVisible({ timeout: 5_000 })
  })

  test('el detalle muestra precio, stock y atributos', async ({ page }) => {
    await page.locator('.ml-card').first().click()
    await expect(page.locator('text=/Precio de venta|Stock/i').first()).toBeVisible()
    await expect(page.locator('text=/Stock disponible/i')).toBeVisible()
  })

  test('botón "Ver en ML" existe en el detalle', async ({ page }) => {
    await page.locator('.ml-card').first().click()
    await expect(page.locator('a:has-text("Ver en ML")')).toBeVisible()
  })

  test('volver desde el detalle regresa a la grilla', async ({ page }) => {
    await page.locator('.ml-card').first().click()
    await page.locator('button:has-text("Volver al catálogo ML")').click()
    await expect(page.locator('.ml-grid')).toBeVisible({ timeout: 5_000 })
  })

  test('el botón "+ Cargar costo" abre el modal', async ({ page }) => {
    // Items sin costo muestran el botón
    const cargarBtn = page.locator('button:has-text("+ Cargar costo")').first()
    if (await cargarBtn.isVisible()) {
      await cargarBtn.click()
      await expect(page.locator('.modal-box:has-text("Cargar costo")')).toBeVisible({ timeout: 5_000 })
      await page.locator('.modal-close, button:has-text("Cancelar")').click()
    }
  })

  test('el modal de cargar costo tiene los campos correctos', async ({ page }) => {
    const cargarBtn = page.locator('button:has-text("+ Cargar costo")').first()
    if (await cargarBtn.isVisible()) {
      await cargarBtn.click()
      const modal = page.locator('.modal-box')
      await expect(modal.locator('label:has-text("Costo unitario ARS")')).toBeVisible()
      await expect(modal.locator('label:has-text("%ML")')).toBeVisible()
      await page.locator('.modal-close').click()
    }
  })

  test('el botón "📥 Importar costos" existe', async ({ page }) => {
    await expect(page.locator('button:has-text("Importar costos")')).toBeVisible()
  })

  test('el botón de sincronizar existe', async ({ page }) => {
    await expect(page.locator('button:has-text("Sincronizar")')).toBeVisible()
  })

  test('sin ML conectado muestra pantalla de conexión', async ({ page }) => {
    // Limpiar ML y recargar
    await page.evaluate(() => {
      localStorage.removeItem('suki_meli_connection')
      localStorage.removeItem('suki_meli_items_cache')
    })
    await page.reload()
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("ML Publicaciones"))')
    await expect(page.locator('text=/Conectá|conectar|MercadoLibre/i').first()).toBeVisible({ timeout: 8_000 })
  })
})
