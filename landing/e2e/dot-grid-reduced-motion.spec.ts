import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'

test.use({
  baseURL: BASE,
  viewport: { width: 1280, height: 800 },
})

test('dot grid still reacts to mouse when prefers-reduced-motion is set', async ({ page, context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark') } catch {}
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/en/?nofx=1', { waitUntil: 'networkidle' })

  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  expect(reduced).toBe(true)

  const sample = async (label: string) => {
    const result = await page.evaluate(({ x, y, w, h }) => {
      const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement
      const ctx = c.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      const data = ctx.getImageData(
        Math.floor(x * dpr), Math.floor(y * dpr),
        Math.floor(w * dpr), Math.floor(h * dpr),
      ).data
      let nz = 0, sR = 0, sB = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) { nz++; sR += data[i]; sB += data[i + 2] }
      }
      return { nz, avgR: nz ? sR / nz : 0, avgB: nz ? sB / nz : 0 }
    }, { x: 580, y: 340, w: 120, h: 120 })
    return { label, ...result }
  }

  await page.mouse.move(50, 50)
  await page.waitForTimeout(300)
  const off = await sample('off')

  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(50 + (590 * i / 12), 50 + (350 * i / 12))
  }
  await page.waitForTimeout(300)
  const on = await sample('on')

  console.log('reduced-motion OFF:', JSON.stringify(off))
  console.log('reduced-motion ON: ', JSON.stringify(on))

  // Even with reduced motion, dots near cursor must light up (more lit pixels + brand-blue tint).
  expect(on.nz, `dots must still react under reduced-motion: off=${off.nz} on=${on.nz}`).toBeGreaterThan(off.nz * 5)
  expect(on.avgB - on.avgR, `cursor-on must shift toward brand blue under reduced-motion: r=${on.avgR.toFixed(0)} b=${on.avgB.toFixed(0)}`).toBeGreaterThan(80)
})
