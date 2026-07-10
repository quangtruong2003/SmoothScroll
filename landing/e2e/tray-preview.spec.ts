import { test, expect } from '@playwright/test'

/**
 * Interactive TrayPreview on the landing page.
 *
 * These tests run against the locally-built landing site. Pass
 * PLAYWRIGHT_BASE_URL=http://localhost:3000/ when invoking.
 */

test.describe('Landing — interactive TrayPreview', () => {
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
    // quitting state: both switches flip OFF
    await expect(tray.getByLabel('Smooth Scrolling')).not.toBeChecked()
    await expect(tray.getByLabel('Start with Windows')).not.toBeChecked()

    // Wait past the 5s closed-state timer
    await page.waitForTimeout(5500)
    await expect(tray).toContainText('Click to reopen')
  })

  test('Click to reopen resets the panel', async ({ page }) => {
    test.setTimeout(15_000)
    await page.goto('/')
    await page.getByText('Quit').click()
    await page.waitForTimeout(5500)
    await page.getByText('Click to reopen').click()
    const tray2 = page.getByTestId('tray-preview')
    await expect(tray2).toContainText('On')
    await expect(tray2.getByLabel('Smooth Scrolling')).toBeChecked()
    await expect(tray2.getByLabel('Start with Windows')).toBeChecked()
  })
})
