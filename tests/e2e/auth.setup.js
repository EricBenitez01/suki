import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const authFile = 'tests/.auth/user.json'

setup('autenticar usuario de prueba', async ({ page }) => {
  const email    = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD

  // Ensure auth dir exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  if (!email || !password) {
    // No credentials — save empty storage state so dependent tests can still run.
    // Tests will detect the login form and handle it per-test.
    await page.context().storageState({ path: authFile })
    console.warn('[auth.setup] TEST_EMAIL/TEST_PASSWORD not set — saving empty session. Set them in .env.test to test authenticated flows.')
    return
  }

  await page.goto('/')
  await expect(page.locator('.login-box, .app-shell')).toBeVisible({ timeout: 15_000 })

  // Already logged in (hot reload / existing session)
  if (await page.locator('.app-shell').isVisible()) {
    await page.context().storageState({ path: authFile })
    return
  }

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  await page.context().storageState({ path: authFile })
})
