import { test, expect } from '@playwright/test'

test.describe('tray preview', () => {
  test('renders only the live tray without decorative cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await expect(page.locator('[data-scene="stack"]')).toHaveCount(0)
    await expect(page.locator('[data-stack-card]')).toHaveCount(0)
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toBeVisible()
    await tray.getByLabel('Smooth Scrolling').click()
    await expect(tray.getByLabel('Smooth Scrolling')).not.toBeChecked()
  })

  test('stays within viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await expect(page.getByTestId('tray-preview')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

})
