import { test, expect } from '@playwright/test'

test.describe('Dot grid overlay', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const theme of ['light', 'dark'] as const) {
    test(`dot grid renders and tracks mouse - ${theme}`, async ({ page }) => {
      await page.addInitScript((t: string) => {
        try { localStorage.setItem('theme', t) } catch {}
      }, theme)

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // The dot grid is a fixed div with bg-dot-grid class
      const gridInfo = await page.evaluate(() => {
        const el = document.querySelector('.bg-dot-grid') as HTMLElement | null
        if (!el) return null
        const cs = getComputedStyle(el)
        return {
          position: cs.position,
          zIndex: cs.zIndex,
          pointerEvents: cs.pointerEvents,
        }
      })
      expect(gridInfo).not.toBeNull()
      expect(gridInfo!.position).toBe('fixed')
      expect(gridInfo!.pointerEvents).toBe('none')

      // Mouse move should update --mx and --my CSS custom properties
      const propsBefore = await page.evaluate(() => {
        const el = document.querySelector('.bg-dot-grid') as HTMLElement
        return {
          mx: el.style.getPropertyValue('--mx'),
          my: el.style.getPropertyValue('--my'),
        }
      })

      await page.mouse.move(640, 400)
      await page.waitForTimeout(300)

      const propsAfter = await page.evaluate(() => {
        const el = document.querySelector('.bg-dot-grid') as HTMLElement
        return {
          mx: el.style.getPropertyValue('--mx'),
          my: el.style.getPropertyValue('--my'),
        }
      })

      // --mx and --my should have changed after mouse move
      expect(propsAfter.mx).not.toBe(propsBefore.mx)
      expect(propsAfter.my).not.toBe(propsBefore.my)
    })
  }
})
