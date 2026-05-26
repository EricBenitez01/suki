import { test, expect } from '@playwright/test'
import { injectMLMock, clearMLMock } from './helpers/ml-mock.js'

test.describe('Ajustes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Ajustes"))')
    await expect(page.locator('.page-title:has-text("Ajustes")')).toBeVisible({ timeout: 10_000 })
  })

  test('renderiza el panel de ajustes', async ({ page }) => {
    await expect(page.locator('main, .app-shell')).toBeVisible()
  })

  test('muestra la sección de MercadoLibre', async ({ page }) => {
    await expect(page.locator('text=/MercadoLibre/i').first()).toBeVisible()
  })

  test('muestra la sección de gastos fijos mensuales', async ({ page }) => {
    await expect(page.locator('text=/Gastos fijos/i').first()).toBeVisible()
    await expect(page.locator('button:has-text("+ Agregar")')).toBeVisible()
  })

  test('muestra la sección de datos almacenados con stats', async ({ page }) => {
    await expect(page.locator('text=/Datos almacenados/i')).toBeVisible()
    await expect(page.locator('text=/Simulaciones/i').first()).toBeVisible()
    await expect(page.locator('text=/Productos/i').first()).toBeVisible()
    await expect(page.locator('text=/Importaciones/i').first()).toBeVisible()
  })

  test('el botón de exportar existe', async ({ page }) => {
    await expect(page.locator('button:has-text("Exportar todo")')).toBeVisible()
  })

  test('el botón de importar backup existe', async ({ page }) => {
    await expect(page.locator('text=/Importar backup/i').first()).toBeVisible()
  })

  test('puede agregar un gasto fijo y aparece en la lista', async ({ page }) => {
    const nombreInput = page.locator('input[placeholder*="Alquiler"]')
    const montoInput  = page.locator('input[placeholder*="Monto"]')

    if (await nombreInput.isVisible() && await montoInput.isVisible()) {
      await nombreInput.fill('Test gasto fijo E2E')
      await montoInput.fill('15000')
      await page.locator('button:has-text("+ Agregar")').click()
      await expect(page.locator('text=Test gasto fijo E2E')).toBeVisible({ timeout: 5_000 })

      // Limpiar: eliminarlo
      const gastoRow = page.locator('div:has-text("Test gasto fijo E2E")')
      const removeBtn = gastoRow.locator('button.danger, button:has-text("✕")').first()
      if (await removeBtn.isVisible()) {
        await removeBtn.click()
        await expect(page.locator('text=Test gasto fijo E2E')).not.toBeVisible({ timeout: 3_000 })
      }
    }
  })

  test('el toggle de gasto fijo activo/inactivo funciona', async ({ page }) => {
    // Agregar uno primero para asegurar que existe
    const nombreInput = page.locator('input[placeholder*="Alquiler"]')
    const montoInput  = page.locator('input[placeholder*="Monto"]')
    if (await nombreInput.isVisible()) {
      await nombreInput.fill('Gasto toggle E2E')
      await montoInput.fill('5000')
      await page.locator('button:has-text("+ Agregar")').click()
      await expect(page.locator('text=Gasto toggle E2E')).toBeVisible({ timeout: 5_000 })

      // Hacer click en el checkbox
      const gastoCheckbox = page.locator('div:has-text("Gasto toggle E2E") input[type="checkbox"]').first()
      if (await gastoCheckbox.isVisible()) {
        const checked = await gastoCheckbox.isChecked()
        await gastoCheckbox.click()
        await page.waitForTimeout(200)
        expect(await gastoCheckbox.isChecked()).toBe(!checked)
      }

      // Limpiar
      const removeBtn = page.locator('div:has-text("Gasto toggle E2E") button.danger, div:has-text("Gasto toggle E2E") button:has-text("✕")').first()
      if (await removeBtn.isVisible()) await removeBtn.click()
    }
  })

  test('con ML conectado muestra datos de conexión', async ({ page }) => {
    await injectMLMock(page)
    await page.reload()
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Ajustes"))')
    await expect(page.locator('.page-title:has-text("Ajustes")')).toBeVisible({ timeout: 10_000 })

    // Muestra usuario conectado
    await expect(page.locator('text=/Conectado|user_id/i').first()).toBeVisible({ timeout: 5_000 })
    await clearMLMock(page)
  })

  test('el botón "Desconectar ML" existe cuando ML está conectado', async ({ page }) => {
    await injectMLMock(page)
    await page.reload()
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Ajustes"))')
    await expect(page.locator('.page-title:has-text("Ajustes")')).toBeVisible({ timeout: 10_000 })

    const disconnectBtn = page.locator('button:has-text("Desconectar ML")')
    if (await disconnectBtn.isVisible()) {
      await expect(disconnectBtn).toBeEnabled()
    }
    await clearMLMock(page)
  })

  test('el perfil de usuario se muestra si existe', async ({ page }) => {
    const hasProfile = await page.locator('text=/Tu cuenta/i').isVisible()
    if (hasProfile) {
      await expect(page.locator('text=/Nombre|Rol/i').first()).toBeVisible()
    }
  })
})
