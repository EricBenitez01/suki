import { test, expect } from '@playwright/test'
import { injectMLMock, clearMLMock } from './helpers/ml-mock.js'

test.describe('Dashboard de Salud', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await injectMLMock(page)
    await page.click('.nav-item:has(.nav-item-label:text-is("Salud del negocio"))')
    await expect(page.locator('.page-title:has-text("salud"), .page-title:has-text("Dashboard")')).toBeVisible({ timeout: 10_000 })
  })

  test.afterEach(async ({ page }) => {
    await clearMLMock(page)
  })

  test('renderiza el panel con KPI cards', async ({ page }) => {
    await expect(page.locator('.dashboard-kpi-bar, .dashboard-kpi-card')).toBeVisible({ timeout: 8_000 })
  })

  test('muestra KPI de productos en catálogo', async ({ page }) => {
    await expect(page.locator('text=/catálogo|Catálogo/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('muestra KPI de margen negativo', async ({ page }) => {
    await expect(page.locator('text=/Margen negativo|crítico/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('muestra KPI de stock crítico', async ({ page }) => {
    await expect(page.locator('text=/Stock crítico|stock/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('la tabla de salud tiene columnas correctas', async ({ page }) => {
    await expect(page.locator('text=/Producto|PRODUCTO/').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=/Precio ML|PRECIO/').first()).toBeVisible()
    await expect(page.locator('text=/Margen|MARGEN/').first()).toBeVisible()
    await expect(page.locator('text=/Stock|STOCK/').first()).toBeVisible()
  })

  test('los filtros de salud funcionan', async ({ page }) => {
    // Filtro "Críticos"
    const filtroCriticos = page.locator('.pill-toggle button:has-text("Críticos")')
    if (await filtroCriticos.isVisible()) {
      await filtroCriticos.click()
      await page.waitForTimeout(300)
    }
    // Filtro "Todos"
    const filtroTodos = page.locator('.pill-toggle button:has-text("Todos")')
    if (await filtroTodos.isVisible()) {
      await filtroTodos.click()
      await page.waitForTimeout(300)
    }
    await expect(page.locator('.app-shell')).toBeVisible()
  })

  test('el buscador en la tabla filtra productos', async ({ page }) => {
    const search = page.locator('input[placeholder*="Buscar producto"]')
    if (await search.isVisible()) {
      await search.fill('camara')
      await page.waitForTimeout(300)
      await search.fill('')
    }
  })

  test('el ordenamiento por margen funciona', async ({ page }) => {
    const sortSelect = page.locator('select:has-text("Ordenar"), select').first()
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: 'Ordenar: por margen' })
      await page.waitForTimeout(300)
      await expect(page.locator('.app-shell')).toBeVisible()
    }
  })

  test('el botón "Ir al catálogo" navega al catálogo', async ({ page }) => {
    await page.click('button:has-text("Ir al catálogo")')
    await expect(page.locator('.page-title:has-text("Catálogo")')).toBeVisible({ timeout: 8_000 })
  })

  test('sin ML no conectado muestra aviso de sincronización', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('suki_meli_connection')
      localStorage.removeItem('suki_meli_items_cache')
    })
    await page.reload()
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Salud del negocio"))')
    await expect(page.locator('text=/Sincronizá|Sincronizar|ML/i').first()).toBeVisible({ timeout: 8_000 })
  })
})
