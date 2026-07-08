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

  test('brand-marquee-track has animation: none when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/en/')

    const animationName = await page.evaluate(() => {
      const track = document.querySelector('.brand-marquee-track') as HTMLElement
      return track ? getComputedStyle(track).animationName : 'no-track'
    })

    expect(animationName).toBe('none')
    await context.close()
  })
})
