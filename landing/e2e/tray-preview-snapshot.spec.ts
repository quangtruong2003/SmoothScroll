import { test } from '@playwright/test'

/**
 * Capture visual snapshots of TrayPreview for design review.
 * Output: landing/screenshots/tray-{running,quitting,closed,vi}.png
 */

test.describe('TrayPreview visual capture', () => {
  test('running state — light', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tray-preview"]')
      el?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(300)
    const tray = page.getByTestId('tray-preview')
    await tray.screenshot({ path: 'screenshots/tray-running.png' })
  })

  test('quitting state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tray-preview"]')
      el?.scrollIntoView({ block: 'center' })
    })
    await page.getByText('Quit').click()
    await page.waitForTimeout(150)
    const tray = page.getByTestId('tray-preview')
    await tray.screenshot({ path: 'screenshots/tray-quitting.png' })
  })

  test('closed state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tray-preview"]')
      el?.scrollIntoView({ block: 'center' })
    })
    await page.getByText('Quit').click()
    await page.waitForTimeout(5500)
    const tray = page.getByTestId('tray-preview')
    await tray.screenshot({ path: 'screenshots/tray-closed.png' })
  })

  test('Vietnamese locale', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tray-preview"]')
      el?.scrollIntoView({ block: 'center' })
    })
    // Switch language via localStorage and reload
    await page.evaluate(() => window.localStorage.setItem('smoothscroll-locale', 'vi'))
    await page.reload()
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tray-preview"]')
      el?.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(300)
    const tray = page.getByTestId('tray-preview')
    await tray.screenshot({ path: 'screenshots/tray-vi.png' })
  })
})
