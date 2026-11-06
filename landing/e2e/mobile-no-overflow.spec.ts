import { test, expect } from '@playwright/test'

const PAGES = [
  '/',
  '/how-it-works/',
]

test.describe('Mobile no-horizontal-scroll', () => {
  for (const path of PAGES) {
    test(`mobile 390px ${path} has no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(path)

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
