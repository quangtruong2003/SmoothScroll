import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const LOCALES = ['en', 'vi', 'zh'] as const

test.describe('A11y audit smoke', () => {
  for (const locale of LOCALES) {
    test(`home page /${locale}/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      // Allow CSS-driven color application to settle (avoid FOUC false-positives)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(250)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test(`how-it-works page /${locale}/how-it-works/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/how-it-works/`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(250)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })
  }

  test('html lang attribute matches locale', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/`)
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang).toBe(locale)
    }
  })
})
