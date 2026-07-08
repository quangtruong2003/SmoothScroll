import { test, expect } from '@playwright/test'

test.describe('Reduced motion behavior', () => {
  test.use({ colorScheme: 'light' })

  test('BackgroundDotGrid does not animate when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()

    const rafCalls: number[] = []
    await page.exposeFunction('recordRaf', () => rafCalls.push(performance.now()))

    await page.goto('/en/')

    await page.evaluate(() => {
      const origRaf = window.requestAnimationFrame
      window.requestAnimationFrame = (cb) => {
        ;(window as any).recordRaf()
        return origRaf(cb)
      }
    })

    await page.waitForTimeout(2000)
    expect(rafCalls.length).toBe(0)

    await context.close()
  })

  test('LogoWall region has no animation when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/en/')

    const wrapper = page.getByRole('region', { name: 'Compatible apps and operating systems' })
    await expect(wrapper).toBeVisible()

    const animationName = await wrapper.evaluate((el) => {
      return getComputedStyle(el).animationName
    })
    expect(animationName).toBe('none')
    await context.close()
  })
})
