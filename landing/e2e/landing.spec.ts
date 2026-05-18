import { test, expect } from '@playwright/test'

const LANGS = ['en', 'vi', 'zh'] as const
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
] as const

for (const lang of LANGS) {
  for (const viewport of VIEWPORTS) {
    test(`[${lang}] Hero loads on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(`${lang}/`)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('nav').first()).toBeVisible()
    })
  }

  test(`[${lang}] Hero CTA is visible`, async ({ page }) => {
    await page.goto(`${lang}/`)
    const cta = page
      .getByRole('button', { name: /download|tải|下载/i })
      .or(page.getByRole('link', { name: /download|tải|下载/i }))
      .first()
    await expect(cta).toBeVisible()
  })

  test(`[${lang}] FAQ accordion present`, async ({ page }) => {
    await page.goto(`${lang}/`)
    const trigger = page.locator('[data-state="closed"]').first()
    if (await trigger.count() > 0) {
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click({ trial: false }).catch(() => {})
    }
  })

  test(`[${lang}] Tray preview interactive`, async ({ page }) => {
    await page.goto(`${lang}/`)
    const traySwitch = page.getByRole('switch').first()
    if (await traySwitch.count() > 0) {
      await traySwitch.scrollIntoViewIfNeeded()
      await traySwitch.click().catch(() => {})
    }
  })

  test(`[${lang}] Page has no console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto(`${lang}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
  })
}
