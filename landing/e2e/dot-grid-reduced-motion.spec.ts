import { test, expect } from '@playwright/test'

test('dot grid does not track mouse when prefers-reduced-motion is set', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  expect(reduced).toBe(true)

  const gridExists = await page.evaluate(() => !!document.querySelector('.bg-dot-grid'))
  expect(gridExists).toBe(true)

  await page.mouse.move(640, 400)
  await page.waitForTimeout(500)

  // With reduced motion, BackgroundDotGrid returns early — no listeners, no --mx/--my updates
  const props = await page.evaluate(() => {
    const el = document.querySelector('.bg-dot-grid') as HTMLElement
    return {
      mx: el.style.getPropertyValue('--mx'),
      my: el.style.getPropertyValue('--my'),
    }
  })

  expect(props.mx).toBe('')
  expect(props.my).toBe('')
})
