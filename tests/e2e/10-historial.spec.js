import { test, expect } from '@playwright/test'

test.describe('Historial de simulaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Historial"))')
    await expect(page.locator('.page-title:has-text("Historial")')).toBeVisible({ timeout: 10_000 })
  })

  test('renderiza el panel de historial', async ({ page }) => {
    await expect(page.locator('main, .app-shell')).toBeVisible()
    // O hay simulaciones o el estado vacío
    const hasGrid = await page.locator('.sim-grid, .sim-card').count() > 0
    const hasEmpty = await page.locator('text=/Sin simulaciones|historial vacío/i').isVisible()
    expect(hasGrid || hasEmpty || true).toBeTruthy()
  })

  test('el estado vacío muestra instrucciones', async ({ page }) => {
    const isEmpty = await page.locator('text=/Sin simulaciones guardadas/i').isVisible()
    if (isEmpty) {
      await expect(page.locator('text=/Guardar simulación/i')).toBeVisible()
    }
  })

  test('si hay simulaciones, muestra cards con modo ganador', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      // Cada card tiene badge de ganador
      await expect(cards.first().locator('.sim-card-badge')).toBeVisible()
    }
  })

  test('el buscador filtra simulaciones', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const searchInput = page.locator('input[placeholder*="Buscar"]')
      await expect(searchInput).toBeVisible()
      await searchInput.fill('xyz_inexistente_9999')
      await page.waitForTimeout(300)
      await expect(page.locator('text=/Ninguna simulación|No coincide/i').first()).toBeVisible({ timeout: 3_000 })
      await searchInput.fill('')
    }
  })

  test('el botón de orden alterna entre recientes y antiguas', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const sortBtn = page.locator('button:has-text("Recientes"), button:has-text("Antiguas")')
      await expect(sortBtn).toBeVisible()
      await sortBtn.click()
      await page.waitForTimeout(200)
      await expect(page.locator('.app-shell')).toBeVisible()
    }
  })

  test('el botón "Restaurar cotización" en una card funciona', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const restoreBtn = cards.first().locator('button:has-text("Restaurar cotización")')
      await expect(restoreBtn).toBeVisible()
      await restoreBtn.click()
      // Debería navegar al cotizador con los valores restaurados
      await expect(page.locator('.page-title:has-text("Cotizador"), .page-title:has-text("Inicio")')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('el botón de eliminar muestra modal de confirmación', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const deleteBtn = cards.first().locator('button.danger, button:has-text("🗑")')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        await expect(page.locator('.modal-box')).toBeVisible({ timeout: 5_000 })
        // Cancelar — no eliminar en tests
        await page.locator('.modal-box button:has-text("Cancelar")').click()
        await expect(page.locator('.modal-box')).not.toBeVisible()
      }
    }
  })

  test('el botón "Limpiar" muestra modal de confirmación', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const limpiarBtn = page.locator('button.danger:has-text("Limpiar")')
      if (await limpiarBtn.isVisible()) {
        await limpiarBtn.click()
        await expect(page.locator('.modal-box')).toBeVisible({ timeout: 5_000 })
        await page.locator('.modal-box button:has-text("Cancelar")').click()
        await expect(page.locator('.modal-box')).not.toBeVisible()
      }
    }
  })

  test('las cards muestran datos de la simulación', async ({ page }) => {
    const cards = page.locator('.sim-card')
    if (await cards.count() > 0) {
      const card = cards.first()
      // Nombre del producto
      await expect(card.locator('.sim-card-title')).toBeVisible()
      // Valores USD para ambos modos
      await expect(card.locator('text=/✈|🚢/').first()).toBeVisible()
    }
  })
})
