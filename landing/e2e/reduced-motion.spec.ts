import { test, expect } from '@playwright/test'

test.describe('Reduced motion behavior', () => {
  test.use({ colorScheme: 'light' })

  test('BackgroundDotGrid does not track mouse when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')

    await page.mouse.move(640, 400)
    await page.waitForTimeout(500)

    const props = await page.evaluate(() => {
      const el = document.querySelector('.bg-dot-grid') as HTMLElement
      return el ? {
        mx: el.style.getPropertyValue('--mx'),
        my: el.style.getPropertyValue('--my'),
      } : null
    })

    expect(props).not.toBeNull()
    expect(props!.mx).toBe('')
    expect(props!.my).toBe('')

    await context.close()
  })

  test('LogoWall region has no animation when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')

    const wrapper = page.getByRole('region', { name: 'Compatible apps and operating systems' })
    await expect(wrapper).toBeVisible()

    const animationName = await wrapper.evaluate((el) => {
      return getComputedStyle(el).animationName
    })
    expect(animationName).toBe('none')
    await context.close()
  })

  test('ScrollDemo stays static when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')

    const scene = page.locator('[data-scroll-demo]')
    await expect(scene).toBeVisible()
    await expect(scene.locator('[data-scroll-before]')).toHaveCount(1)
    await expect(scene.locator('[data-scroll-after]')).toHaveCount(1)

    await context.close()
  })
})
