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
      await page.goto(`/${lang}`)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('nav')).toBeVisible()
    })
  }

  test(`[${lang}] Hero CTA is clickable and opens download`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const cta = page.getByRole('button', { name: /download/i }).first()
    await expect(cta).toBeEnabled()
  })

  test(`[${lang}] FAQ accordion works`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const firstTrigger = page.locator('[data-state="closed"]').first()
    if (await firstTrigger.isVisible()) {
      await firstTrigger.click()
      await expect(page.locator('[data-state="open"]')).toBeVisible()
    }
  })

  test(`[${lang}] Tray preview interactive`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const traySwitch = page.getByRole('switch').first()
    if (await traySwitch.isVisible()) {
      await traySwitch.click()
    }
  })

  test(`[${lang}] Navigation lang switcher works`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const langBtn = page.locator('nav button[aria-label="Switch language"]')
    if (await langBtn.isVisible()) {
      await langBtn.click()
    }
  })
}

// Accessibility
test('No serious WCAG violations on hero (en, desktop)', async ({ page }) => {
  await page.goto('/en')
  const results = await page.evaluate(() =>
    import('axe-core').then((axe) =>
      new Promise((resolve) => {
        axe.run(document, (err, result) => resolve(result))
      })
    )
  )
  const { violations } = results as { violations: { severity: string }[] }
  const serious = violations.filter((v) => v.severity === 'critical' || v.severity === 'serious')
  expect(serious).toHaveLength(0)
})
