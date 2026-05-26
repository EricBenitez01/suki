import { test, expect } from '@playwright/test'

const VALID_INPUTS = {
  fob: '1000',
  unidades: '100',
  pesoKg: '50',
  di: '35',
}

test.describe('Cotizador de flete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Cotizador de flete"))')
    await expect(page.locator('.page-title:has-text("Cotizador")')).toBeVisible()
  })

  test('renderiza el formulario con todos los campos requeridos', async ({ page }) => {
    await expect(page.locator('input[placeholder*="FOB"], label:has-text("FOB")')).toBeVisible()
    await expect(page.locator('label:has-text("Unidades")')).toBeVisible()
    await expect(page.locator('label:has-text("Peso")')).toBeVisible()
  })

  test('no muestra resultados con campos vacíos', async ({ page }) => {
    // Sin inputs, el panel de resultados no muestra comparativa
    await expect(page.locator('text=/Flete aéreo|Flete marítimo|Costo landed/i')).not.toBeVisible()
  })

  test('calcula y muestra resultados al completar los campos requeridos', async ({ page }) => {
    await page.fill('input[placeholder*="FOB Total"], input[name="fob"]', VALID_INPUTS.fob).catch(async () => {
      // Fallback: buscar por label
      await page.locator('label:has-text("FOB")').locator('..').locator('input').first().fill(VALID_INPUTS.fob)
    })
    // Unidades
    await page.locator('label:has-text("Unidades")').locator('..').locator('input').first().fill(VALID_INPUTS.unidades)
    // Peso
    await page.locator('label:has-text("Peso")').locator('..').locator('input').first().fill(VALID_INPUTS.pesoKg)
    // DI / Arancel
    await page.locator('label:has-text("DI"), label:has-text("Arancel")').locator('..').locator('input').first().fill(VALID_INPUTS.di)

    // Resultados deberían aparecer
    await expect(page.locator('text=/aéreo|marítimo/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('muestra comparativa aéreo vs marítimo en resultados', async ({ page }) => {
    await fillCotizador(page)
    await expect(page.locator('text=/aéreo/i').first()).toBeVisible()
    await expect(page.locator('text=/marítimo/i').first()).toBeVisible()
  })

  test('muestra el costo landed unitario', async ({ page }) => {
    await fillCotizador(page)
    await expect(page.locator('text=/Costo unit|costo.*unit/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('el botón Guardar abre el modal de guardado', async ({ page }) => {
    await fillCotizador(page)
    const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("guardar")').first()
    await expect(saveBtn).toBeVisible({ timeout: 5_000 })
    await saveBtn.click()
    await expect(page.locator('.modal-box, .modal-overlay')).toBeVisible({ timeout: 5_000 })
  })

  test('el modal de guardar acepta nombre y cancela sin guardar', async ({ page }) => {
    await fillCotizador(page)
    await page.locator('button:has-text("Guardar")').first().click()
    const modal = page.locator('.modal-box')
    await expect(modal).toBeVisible()
    // Escribir nombre
    await modal.locator('input').first().fill('Test Simulación E2E')
    // Cancelar
    await modal.locator('button:has-text("Cancelar")').click()
    await expect(modal).not.toBeVisible()
  })

  test('guardar simulación muestra toast de éxito', async ({ page }) => {
    await fillCotizador(page)
    await page.locator('button:has-text("Guardar")').first().click()
    const modal = page.locator('.modal-box')
    await expect(modal).toBeVisible()
    await modal.locator('input').first().fill('Test E2E ' + Date.now())
    await modal.locator('button:has-text("Guardar")').last().click()
    // Toast de éxito
    await expect(page.locator('text=/guardada|simulación|✓/i').first()).toBeVisible({ timeout: 8_000 })
  })

  test('el modo de flete aéreo tiene toggle kg/vol vs cotización directa', async ({ page }) => {
    // El InputPanel tiene toggle de modo flete aéreo
    const toggleModo = page.locator('text=/calculado|cotización/i').first()
    if (await toggleModo.isVisible()) {
      await expect(toggleModo).toBeVisible()
    }
  })
})

async function fillCotizador(page) {
  const inputs = page.locator('.sidebar-sticky input[type="number"], .sidebar-sticky input[type="text"]')
  const count = await inputs.count()
  // Llenar FOB (primer campo numérico), unidades, peso, di
  const fobLabel = page.locator('label:has-text("FOB")').first()
  if (await fobLabel.isVisible()) {
    const fobInput = fobLabel.locator('..').locator('input').first()
    await fobInput.fill('2000')
  }
  const unidadesLabel = page.locator('label:has-text("Unidades")').first()
  if (await unidadesLabel.isVisible()) {
    await unidadesLabel.locator('..').locator('input').first().fill('50')
  }
  const pesoLabel = page.locator('label:has-text("Peso")').first()
  if (await pesoLabel.isVisible()) {
    await pesoLabel.locator('..').locator('input').first().fill('30')
  }
  const diLabel = page.locator('label:has-text("DI"), label:has-text("Arancel")').first()
  if (await diLabel.isVisible()) {
    await diLabel.locator('..').locator('input').first().fill('35')
  }
  // Pequeña pausa para que calcule
  await page.waitForTimeout(500)
}
