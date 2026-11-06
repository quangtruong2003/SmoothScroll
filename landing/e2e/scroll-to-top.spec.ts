import { test, expect } from '@playwright/test'

test('scroll-to-top button appears after scrolling', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })
  await page.waitForLoadState('networkidle')
  // Wait for client-side hydration of the ScrollToTop component
  await page.waitForTimeout(1000)

  const btn = page.getByRole('button', { name: /scroll to top/i })

  // Scroll down past threshold
  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(600)

  // Button should be visible after scroll
  await expect(btn).toBeVisible()
})

test('clicking scroll-to-top scrolls page to top', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Scroll down
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(600)

  const btn = page.getByRole('button', { name: /scroll to top/i })
  await expect(btn).toBeVisible()

  await btn.click({ force: true })

  // Page should scroll to top
  await page.waitForFunction(() => window.scrollY < 50, { timeout: 3000 })
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
})
