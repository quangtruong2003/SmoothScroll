import { test, expect } from '@playwright/test'

/**
 * Interactive TrayPreview on the landing page.
 *
 * These tests run against the locally-built landing site. Pass
 * PLAYWRIGHT_BASE_URL=http://localhost:3000/ when invoking.
 */

test.describe('Landing — interactive TrayPreview', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('renders SmoothScroll header in ON state', async ({ page }) => {
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('SmoothScroll')
    await expect(tray).toContainText('On')
  })

  test('clicking Smooth Scrolling flips status dot text to Off', async ({ page }) => {
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await tray.getByLabel('Smooth Scrolling').click()
    await expect(tray).toContainText('Off')
  })

  test('toggling Start with Windows does NOT change status dot', async ({ page }) => {
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await tray.getByLabel('Start with Windows').click()
    await expect(tray).toContainText('On')
  })

  test('Quit shows the reopen button after the timer expires', async ({ page }) => {
    test.setTimeout(15_000)
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toContainText('On')

    await page.getByText('Quit').click()
    await expect(tray.getByLabel('Smooth Scrolling')).not.toBeChecked()
    await expect(tray.getByLabel('Start with Windows')).not.toBeChecked()

    await page.waitForTimeout(5500)
    await expect(tray).toContainText('Click to reopen')
  })

  test('Click to reopen resets the panel', async ({ page }) => {
    test.setTimeout(15_000)
    await page.goto('/')
    await page.getByText('Quit').click()
    await page.waitForTimeout(5500)
    await page.getByText('Click to reopen').click()
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toContainText('On')
    await expect(tray.getByLabel('Smooth Scrolling')).toBeChecked()
    await expect(tray.getByLabel('Start with Windows')).toBeChecked()
  })
})

test.describe('Landing — TrayPreview visual regression', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    // Freeze all CSS transitions/animations so screenshots are deterministic.
    contextOptions: { reducedMotion: 'reduce' },
  })

  test('running state matches snapshot', async ({ page }) => {
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toBeVisible()
    await expect(tray).toHaveScreenshot('tray-running.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('closed state matches snapshot', async ({ page }) => {
    test.setTimeout(15_000)
    await page.goto('/')
    await page.getByText('Quit').click()
    await page.waitForTimeout(5500)
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toContainText('Click to reopen')
    await expect(tray).toHaveScreenshot('tray-closed.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
