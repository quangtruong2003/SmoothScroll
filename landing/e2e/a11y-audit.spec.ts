import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const LOCALES = ['en', 'vi', 'zh'] as const

test.describe('A11y audit smoke', () => {
  for (const locale of LOCALES) {
    test(`home page /${locale}/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test(`how-it-works page /${locale}/how-it-works/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/how-it-works/`)
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
