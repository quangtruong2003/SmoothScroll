import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('A11y audit smoke', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(250)
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('how-it-works page has no critical a11y violations', async ({ page }) => {
    await page.goto('/how-it-works/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(250)
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('html lang attribute is set', async ({ page }) => {
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBeTruthy()
  })
})
