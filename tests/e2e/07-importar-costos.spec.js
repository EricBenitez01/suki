import { test, expect } from '@playwright/test'
import { injectMLMock, clearMLMock } from './helpers/ml-mock.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.join(__dirname, 'fixtures', 'sample-costos.csv')

test.describe('Importar costos desde CSV', () => {
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

  test('el botón "Importar costos" abre el modal', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    await expect(page.locator('.modal-box:has-text("Importar costos")')).toBeVisible({ timeout: 5_000 })
  })

  test('el modal muestra instrucciones de exportación CSV', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await expect(modal.locator('text=/Google Sheets|CSV|Archivo/i').first()).toBeVisible()
  })

  test('subir un CSV válido avanza al paso de revisión', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await expect(modal).toBeVisible()

    // Subir CSV con el file input
    const fileInput = modal.locator('input[type="file"]')
    await fileInput.setInputFiles(CSV_PATH)

    // Debería pasar al paso de revisión
    await expect(modal.locator('text=/Revisar|revisión|filas/i').first()).toBeVisible({ timeout: 8_000 })
  })

  test('el paso de revisión muestra las filas del CSV', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await modal.locator('input[type="file"]').setInputFiles(CSV_PATH)

    // Tabla con filas
    await expect(modal.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })
    const rows = modal.locator('table tbody tr')
    expect(await rows.count()).toBeGreaterThanOrEqual(5)
  })

  test('el paso de revisión muestra stats de match', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await modal.locator('input[type="file"]').setInputFiles(CSV_PATH)
    await expect(modal.locator('text=/Match ML|Sin match|Ya cargado/i').first()).toBeVisible({ timeout: 8_000 })
  })

  test('las filas muestran badge MATCH o SIN MATCH', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await modal.locator('input[type="file"]').setInputFiles(CSV_PATH)
    await expect(modal.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })
    // Al menos una fila tiene badge MATCH (el mock tiene mismos SKUs que el CSV)
    await expect(modal.locator('text=MATCH').first()).toBeVisible({ timeout: 5_000 })
  })

  test('el botón "Cambiar archivo" regresa al paso de upload', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await modal.locator('input[type="file"]').setInputFiles(CSV_PATH)
    await expect(modal.locator('text=/Revisar|revisión/i').first()).toBeVisible({ timeout: 8_000 })

    await modal.locator('button:has-text("Cambiar archivo")').click()
    // Vuelve al step de upload
    await expect(modal.locator('text=/Arrastrá|subir|CSV/i').first()).toBeVisible()
  })

  test('cerrar el modal con X funciona en cualquier paso', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await expect(modal).toBeVisible()
    await modal.locator('.modal-close').click()
    await expect(modal).not.toBeVisible()
  })

  test('importar productos muestra pantalla de éxito', async ({ page }) => {
    await page.click('button:has-text("Importar costos")')
    const modal = page.locator('.modal-box')
    await modal.locator('input[type="file"]').setInputFiles(CSV_PATH)
    await expect(modal.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })

    // Click en Importar
    const importBtn = modal.locator('button:has-text("Importar")')
    await expect(importBtn).toBeEnabled({ timeout: 5_000 })
    await importBtn.click()

    // Pantalla de éxito
    await expect(modal.locator('text=/importado|✅|completada/i').first()).toBeVisible({ timeout: 15_000 })
  })
})
