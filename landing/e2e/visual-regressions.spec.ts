import { test, expect } from '@playwright/test'

test('logo wall uses compact spacing and glyph-only Windows icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const firstCell = page.locator('.logo-cell').first()
  await expect(firstCell).toHaveCSS('min-width', '112px')
  await expect(firstCell.locator('img')).toHaveAttribute('src', /\/windows\.svg$/)
})

test('before and after demo stays compact on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const scene = page.locator('[data-scroll-demo]')
  const before = scene.locator('[data-scroll-before]')
  const after = scene.locator('[data-scroll-after]')

  await expect(scene).toBeVisible()
  const layout = await scene.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const beforeRect = element.querySelector('[data-scroll-before]')!.getBoundingClientRect()
    const afterRect = element.querySelector('[data-scroll-after]')!.getBoundingClientRect()
    return { height: rect.height, beforeTop: beforeRect.top, afterTop: afterRect.top }
  })

  expect(layout.height).toBeLessThan(1350)
  expect(Math.abs(layout.beforeTop - layout.afterTop)).toBeLessThan(8)
})

test('final CTA follows dark theme surface tokens', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/')

  await expect(page.locator('html')).toHaveClass(/dark/)
  const cta = page.locator('[data-final-cta]')
  await expect(cta).toBeVisible()
  const background = await cta.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgb(255, 255, 255)')
})
