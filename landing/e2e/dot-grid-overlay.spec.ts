import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'
const OUT_DIR = path.join(process.cwd(), 'test-results', 'dot-grid-overlay')

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
})

test.use({ baseURL: BASE, viewport: { width: 1280, height: 800 } })

async function snapshotPixels(page: any, x: number, y: number, label: string, theme: string) {
  // Crop a small box around the cursor for diff comparison.
  const box = { x: x - 60, y: y - 60, width: 120, height: 120 }
  const file = path.join(OUT_DIR, `${theme}-${label}.png`)
  await page.screenshot({ path: file, clip: box })
  return file
}

async function pixelDelta(beforePath: string, afterPath: string): Promise<number> {
  // Crude byte-level delta: count of differing bytes / total bytes.
  const a = fs.readFileSync(beforePath)
  const b = fs.readFileSync(afterPath)
  if (a.length !== b.length) return 1
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++
  }
  return diff / a.length
}

for (const theme of ['light', 'dark'] as const) {
  test(`dot grid overlay reacts to mouse - ${theme}`, async ({ page }) => {
    // Force theme via localStorage before navigation script runs.
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t)
      } catch {}
    }, theme)

    await page.goto('/en/?nofx=1', { waitUntil: 'networkidle' })

    // Confirm canvas is in DOM and has the overlay z-index.
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement | null
      if (!c) return null
      const cs = getComputedStyle(c)
      const r = c.getBoundingClientRect()
      return {
        present: true,
        zIndex: cs.zIndex,
        position: cs.position,
        pointerEvents: cs.pointerEvents,
        width: c.width,
        height: c.height,
        cssWidth: r.width,
        cssHeight: r.height,
      }
    })
    expect(canvasInfo).not.toBeNull()
    expect(canvasInfo!.present).toBe(true)
    expect(canvasInfo!.zIndex).toBe('50')
    expect(canvasInfo!.pointerEvents).toBe('none')
    expect(canvasInfo!.cssWidth).toBeGreaterThan(0)
    expect(canvasInfo!.cssHeight).toBeGreaterThan(0)

    // Note: pointer-events:none excludes the canvas from elementsFromPoint by design.
    // That's the desired behavior — the page underneath stays interactive.
    // What matters is whether the canvas is actually drawing visible pixels above content.
    const canvasHasPixels = await page.evaluate(() => {
      const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement | null
      if (!c) return { ok: false, reason: 'no canvas' }
      const ctx = c.getContext('2d')
      if (!ctx) return { ok: false, reason: 'no 2d ctx' }
      // Sample a 100x100 region near center; count non-zero alpha pixels.
      const sx = Math.floor(c.width / 2) - 50
      const sy = Math.floor(c.height / 2) - 50
      const data = ctx.getImageData(sx, sy, 100, 100).data
      let nonZero = 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) nonZero++
      }
      return { ok: true, nonZero, total: data.length / 4 }
    })
    expect(canvasHasPixels.ok, JSON.stringify(canvasHasPixels)).toBe(true)
    expect(canvasHasPixels.nonZero, `canvas must have visible static dots: ${JSON.stringify(canvasHasPixels)}`).toBeGreaterThan(10)

    // Walk all fixed/absolute ancestors that span viewport with opaque bg.
    const blockers = await page.evaluate(() => {
      const out: any[] = []
      const all = document.querySelectorAll('*')
      for (const el of Array.from(all)) {
        const cs = getComputedStyle(el)
        if (cs.position !== 'fixed' && cs.position !== 'absolute') continue
        const r = el.getBoundingClientRect()
        if (r.width < window.innerWidth * 0.9) continue
        if (r.height < window.innerHeight * 0.9) continue
        const bg = cs.backgroundColor
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') || '').slice(0, 80),
          z: cs.zIndex,
          bg,
        })
      }
      return out
    })
    // Log but do not fail; the overlay is on top of these.
    console.log(`[${theme}] full-viewport opaque elements:`, JSON.stringify(blockers))

    // Move mouse off-canvas first.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)

    // Compare canvas pixels in a fixed region: cursor far away vs cursor on it.
    // Reads canvas.getImageData directly so we get raw RGBA, not PNG-compressed bytes.
    const CROP = { x: 580, y: 340, width: 120, height: 120 }
    const center = { x: CROP.x + CROP.width / 2, y: CROP.y + CROP.height / 2 }

    const samplePixels = async (label: string) => {
      const result = await page.evaluate(({ x, y, w, h }) => {
        const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement
        const ctx = c.getContext('2d')!
        const dpr = window.devicePixelRatio || 1
        const data = ctx.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), Math.floor(w * dpr), Math.floor(h * dpr)).data
        // Histogram: count alpha buckets and total non-zero alpha.
        let nonZero = 0
        let alphaSum = 0
        let rSum = 0, gSum = 0, bSum = 0
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a > 0) {
            nonZero++
            alphaSum += a
            rSum += data[i]
            gSum += data[i + 1]
            bSum += data[i + 2]
          }
        }
        return {
          nonZeroAlpha: nonZero,
          totalPx: data.length / 4,
          avgAlpha: nonZero ? alphaSum / nonZero : 0,
          avgR: nonZero ? rSum / nonZero : 0,
          avgG: nonZero ? gSum / nonZero : 0,
          avgB: nonZero ? bSum / nonZero : 0,
        }
      }, { x: CROP.x, y: CROP.y, w: CROP.width, h: CROP.height })
      console.log(`[${theme}] ${label}:`, JSON.stringify(result))
      return result
    }

    // Cursor is far away from the crop region.
    await page.mouse.move(50, 50)
    await page.waitForTimeout(400)
    const off = await samplePixels('cursor-off (50,50)')
    await page.screenshot({ path: path.join(OUT_DIR, `${theme}-cursor-off.png`), clip: CROP })

    // Move cursor INTO the crop center. Move slowly so onMove + rAF run.
    const steps = 12
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(50 + ((center.x - 50) * i) / steps, 50 + ((center.y - 50) * i) / steps)
    }
    await page.waitForTimeout(350)
    const on = await samplePixels('cursor-on (640,400)')
    await page.screenshot({ path: path.join(OUT_DIR, `${theme}-cursor-on.png`), clip: CROP })

    // Real pixel evidence:
    //  - off: only static dots → small nonZeroAlpha footprint, neutral color.
    //  - on: dots near cursor are bigger (more lit pixels), with halo/shadow blur,
    //        and tinted toward the brand color (high blue, low red).
    expect(off.nonZeroAlpha, `static dots must be present off-cursor: ${JSON.stringify(off)}`).toBeGreaterThan(10)
    expect(
      on.nonZeroAlpha,
      `cursor-on must light up many more pixels (size+halo): off=${off.nonZeroAlpha} on=${on.nonZeroAlpha}`,
    ).toBeGreaterThan(off.nonZeroAlpha * 5)
    // Brand color is roughly hsl(220 ~95% ~70%) → blue dominant. avgB should be much higher than avgR.
    expect(
      on.avgB - on.avgR,
      `cursor-on must shift toward brand blue: avgR=${on.avgR.toFixed(0)} avgB=${on.avgB.toFixed(0)}`,
    ).toBeGreaterThan(80)

    // Sweep cursor and screenshot for visual record.
    for (const [x, y] of [[320, 200], [1100, 700]] as [number, number][]) {
      const s = 8
      for (let i = 1; i <= s; i++) {
        await page.mouse.move(50 + ((x - 50) * i) / s, 50 + ((y - 50) * i) / s)
      }
      await page.waitForTimeout(220)
      await page.screenshot({
        path: path.join(OUT_DIR, `${theme}-cursor-${x}-${y}.png`),
        clip: { x: x - 60, y: y - 60, width: 120, height: 120 },
      })
    }

    // Full-page screenshot for visual record.
    await page.screenshot({ path: path.join(OUT_DIR, `${theme}-full.png`), fullPage: false })
  })
}
