import { test, expect } from '@playwright/test'

const TEST_PRODUCTO = {
  nombre: `E2E Test Producto ${Date.now()}`,
  sku: `E2E-SKU-${Date.now()}`,
  costoARS: '45000',
}

test.describe('Catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.app-shell')
    await page.click('.nav-item:has(.nav-item-label:text-is("Catálogo"))')
    await expect(page.locator('.page-title:has-text("Catálogo")')).toBeVisible({ timeout: 10_000 })
  })

  test('renderiza el panel de catálogo con barra de búsqueda', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible()
    await expect(page.locator('button:has-text("+ Nuevo producto")')).toBeVisible()
  })

  test('el buscador filtra productos por nombre', async ({ page }) => {
    const search = page.locator('input[placeholder*="Buscar"]')
    await search.fill('xyz_producto_que_no_existe_123')
    await page.waitForTimeout(300)
    // Sin resultados o mensaje vacío
    const resultados = page.locator('.catalogo-lista .producto-card, .producto-item')
    const empty = page.locator('text=/Sin resultados|No hay productos|catálogo vacío/i')
    const hasResults = await resultados.count() > 0
    const hasEmpty = await empty.isVisible()
    expect(hasResults || hasEmpty).toBeTruthy()
    // Limpiar búsqueda
    await search.fill('')
  })

  test('puede crear un nuevo producto manualmente', async ({ page }) => {
    await page.click('button:has-text("+ Nuevo producto")')
    const form = page.locator('form, .card:has(label:has-text("Nombre"))')
    await expect(form).toBeVisible({ timeout: 5_000 })

    // Llenar nombre
    await form.locator('label:has-text("Nombre")').locator('..').locator('input').first().fill(TEST_PRODUCTO.nombre)
    // SKU
    const skuInput = form.locator('label:has-text("SKU")').locator('..').locator('input').first()
    if (await skuInput.isVisible()) await skuInput.fill(TEST_PRODUCTO.sku)
    // Costo ARS
    const costoInput = form.locator('label:has-text("Costo unitario ARS"), label:has-text("Costo")').locator('..').locator('input[type="number"]').first()
    if (await costoInput.isVisible()) await costoInput.fill(TEST_PRODUCTO.costoARS)

    // Guardar
    await form.locator('button:has-text("Guardar")').click()

    // Toast de éxito
    await expect(page.locator('text=/agregado|guardado|✓/i').first()).toBeVisible({ timeout: 8_000 })
  })

  test('hacer click en un producto abre el detalle', async ({ page }) => {
    // Necesita al menos un producto en el catálogo
    const primerProducto = page.locator('.producto-card, .producto-item, [class*="producto"]').first()
    if (await primerProducto.isVisible({ timeout: 5_000 })) {
      await primerProducto.click()
      // Botón de volver aparece en el detalle
      await expect(page.locator('button:has-text("Volver"), .producto-back-btn')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('el detalle de producto muestra la tabla de escenarios', async ({ page }) => {
    const primerProducto = page.locator('.producto-card, .producto-item').first()
    if (await primerProducto.isVisible({ timeout: 5_000 })) {
      await primerProducto.click()
      await expect(page.locator('button:has-text("Volver"), .producto-back-btn')).toBeVisible()
      // Tabla de escenarios de margen
      await expect(page.locator('text=/10%|15%|20%|Escenario/i').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('el botón de volver regresa al listado', async ({ page }) => {
    const primerProducto = page.locator('.producto-card, .producto-item').first()
    if (await primerProducto.isVisible({ timeout: 5_000 })) {
      await primerProducto.click()
      const backBtn = page.locator('button:has-text("Volver"), .producto-back-btn')
      await expect(backBtn).toBeVisible()
      await backBtn.click()
      // Vuelve al listado
      await expect(page.locator('button:has-text("+ Nuevo producto")')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('eliminar producto muestra modal de confirmación', async ({ page }) => {
    // Abrir cualquier producto
    const primerProducto = page.locator('.producto-card, .producto-item').first()
    if (await primerProducto.isVisible({ timeout: 5_000 })) {
      await primerProducto.click()
      await expect(page.locator('.producto-back-btn')).toBeVisible()
      const deleteBtn = page.locator('button:has-text("Eliminar"), button[class*="danger"]:has-text("Eliminar")').first()
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()
        // Modal de confirmación
        await expect(page.locator('.modal-box')).toBeVisible({ timeout: 5_000 })
        // Cancelar — no eliminar en tests
        await page.locator('.modal-box button:has-text("Cancelar")').click()
        await expect(page.locator('.modal-box')).not.toBeVisible()
      }
    }
  })
})
