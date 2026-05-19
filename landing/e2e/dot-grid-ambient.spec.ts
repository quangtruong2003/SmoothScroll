import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'

test.use({ baseURL: BASE, viewport: { width: 1280, height: 800 } })

for (let fx = 0; fx < 7; fx++) {
  test(`ambient effect ${fx} produces motion over time`, async ({ page, context }) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark') } catch {}
    })
    await page.goto(`/en/?fx=${fx}`, { waitUntil: 'networkidle' })

    const sample = async () => {
      return await page.evaluate(() => {
        const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement
        const ctx = c.getContext('2d')!
        const data = ctx.getImageData(0, 0, c.width, c.height).data
        // Aggregate RGB sums + non-zero alpha count. These shift any time
        // a dot's brightness, position, or glow halo changes.
        let rSum = 0, gSum = 0, bSum = 0, nz = 0
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a > 0) {
            nz++
            rSum += data[i]
            gSum += data[i + 1]
            bSum += data[i + 2]
          }
        }
        return `${nz}|${rSum}|${gSum}|${bSum}`
      })
    }

    const samples: string[] = []
    for (let s = 0; s < 4; s++) {
      samples.push(await sample())
      if (s < 3) await page.waitForTimeout(500)
    }
    const unique = new Set(samples)
    expect(unique.size, `effect ${fx}: at least 2 distinct frames across 4 samples (got ${samples.join(' / ')})`).toBeGreaterThan(1)
  })
}
