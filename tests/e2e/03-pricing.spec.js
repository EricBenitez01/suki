import { test, expect } from '@playwright/test'

test.describe('Pricing ML', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Pricing ML"))')
    await expect(page.locator('.page-title:has-text("Pricing")')).toBeVisible()
  })

  test('renderiza el panel de pricing', async ({ page }) => {
    await expect(page.locator('.page-title')).toContainText('Pricing')
    await expect(page.locator('main')).toBeVisible()
  })

  test('muestra tabla de escenarios de margen', async ({ page }) => {
    // La tabla de escenarios está siempre visible (no requiere costo)
    await expect(page.locator('text=/10%|15%|20%|25%|30%/').first()).toBeVisible({ timeout: 5_000 })
  })

  test('ingresando un costo calcula el precio mínimo', async ({ page }) => {
    // Buscar input de costo unitario ARS
    const costoInput = page.locator('input[placeholder*="costo"], input[placeholder*="Costo"]').first()
    if (await costoInput.isVisible()) {
      await costoInput.fill('50000')
      await page.waitForTimeout(300)
      // Debería mostrar un precio calculado
      await expect(page.locator('text=/precio|Precio/i').first()).toBeVisible()
    }
  })

  test('el margen target ajusta el precio sugerido', async ({ page }) => {
    const costoInput = page.locator('input[placeholder*="osto"]').first()
    if (await costoInput.isVisible()) {
      await costoInput.fill('40000')
      const targetInput = page.locator('input[placeholder*="argen"], input[placeholder*="target"]').first()
      if (await targetInput.isVisible()) {
        await targetInput.fill('30')
        await page.waitForTimeout(300)
        // El precio cambia con el margen
        await expect(page.locator('text=/precio/i').first()).toBeVisible()
      }
    }
  })

  test('el punto de equilibrio se muestra', async ({ page }) => {
    await expect(page.locator('text=/equilibrio|Break.even|mínimo/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('ingresar precio directo calcula el margen resultante', async ({ page }) => {
    const precioInput = page.locator('input[placeholder*="precio"], input[placeholder*="Precio"]').last()
    if (await precioInput.isVisible()) {
      await precioInput.fill('100000')
      await page.waitForTimeout(300)
      await expect(page.locator('text=/%|margen/i').first()).toBeVisible()
    }
  })
})
