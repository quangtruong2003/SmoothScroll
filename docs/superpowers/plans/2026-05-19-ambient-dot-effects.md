# Ambient Dot Grid Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 ambient dot animations that always run in the background, randomly selected per visit, composed additively with the existing cursor magnet effect.

**Architecture:** Pure-function effect interface — each effect is a deterministic `(p, i, t, ctx) → {ox, oy, f}`. Selection happens once at mount via `Math.random()` (override with `?fx=N`). drawFrame composes ambient offset + magnet offset and `max(ambientF, magnetF)` for glow.

**Tech Stack:** TypeScript, React 18, HTML5 Canvas 2D, Vitest (existing test runner from `dotGrid.test.ts`).

**Spec:** [docs/superpowers/specs/2026-05-19-ambient-dot-effects-design.md](../specs/2026-05-19-ambient-dot-effects-design.md)

---

## Pre-flight

- [ ] **Step 0: Verify dev environment**

Run: `cd d:/SmoothScroll/landing && npm test -- --run lib/dotGrid.test.ts`
Expected: existing 11 tests pass.

---

## Task 1: Effect interface + first 4 wave/ripple effects

**Files:**
- Create: `landing/lib/ambientEffects.ts`
- Create: `landing/lib/ambientEffects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// landing/lib/ambientEffects.test.ts
import { describe, it, expect } from 'vitest'
import { EFFECTS, pickEffect } from './ambientEffects'

const ctx = { vw: 1280, vh: 800, reduced: false }
const samplePoints = [
  { x: 0, y: 0 }, { x: 640, y: 400 }, { x: 1279, y: 799 },
  { x: 100, y: 100 }, { x: 1100, y: 700 },
]

describe('ambientEffects', () => {
  it('exports exactly 10 effects', () => {
    expect(EFFECTS).toHaveLength(10)
  })

  it('every effect has a name and update fn', () => {
    for (const e of EFFECTS) {
      expect(typeof e.name).toBe('string')
      expect(e.name.length).toBeGreaterThan(0)
      expect(typeof e.update).toBe('function')
    }
  })

  it('every effect returns finite numbers and bounded f for 100 frames', () => {
    for (const eff of EFFECTS) {
      for (let frame = 0; frame < 100; frame++) {
        const t = frame / 60
        for (let i = 0; i < samplePoints.length; i++) {
          const r = eff.update(samplePoints[i], i, t, ctx)
          expect(Number.isFinite(r.ox), `${eff.name} ox`).toBe(true)
          expect(Number.isFinite(r.oy), `${eff.name} oy`).toBe(true)
          expect(Number.isFinite(r.f), `${eff.name} f`).toBe(true)
          expect(r.f).toBeGreaterThanOrEqual(0)
          expect(r.f).toBeLessThanOrEqual(1)
          expect(Math.abs(r.ox)).toBeLessThanOrEqual(20)
          expect(Math.abs(r.oy)).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('reduced motion shrinks displacement on motion effects', () => {
    const p = { x: 200, y: 200 }
    for (const eff of EFFECTS) {
      let maxNormal = 0, maxReduced = 0
      for (let frame = 0; frame < 200; frame++) {
        const t = frame / 30
        const n = eff.update(p, 0, t, { vw: 1280, vh: 800, reduced: false })
        const r = eff.update(p, 0, t, { vw: 1280, vh: 800, reduced: true })
        maxNormal = Math.max(maxNormal, Math.abs(n.ox), Math.abs(n.oy))
        maxReduced = Math.max(maxReduced, Math.abs(r.ox), Math.abs(r.oy))
      }
      // Either the effect has no displacement at all (glow-only), or reduced is <= normal.
      if (maxNormal > 0.5) {
        expect(maxReduced, `${eff.name} reduced`).toBeLessThanOrEqual(maxNormal * 0.5)
      }
    }
  })

  it('pickEffect returns a valid index in range', () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickEffect()
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(EFFECTS.length)
      expect(Number.isInteger(idx)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test, expect FAIL (module missing)**

Run: `cd d:/SmoothScroll/landing && npm test -- --run lib/ambientEffects.test.ts`
Expected: FAIL — "Cannot find module './ambientEffects'"

- [ ] **Step 3: Implement skeleton + effects 1–4**

```ts
// landing/lib/ambientEffects.ts
import type { Point } from './dotGrid'

export interface EffectCtx {
  vw: number
  vh: number
  reduced: boolean
}

export interface EffectOutput {
  ox: number
  oy: number
  f: number
}

export interface Effect {
  name: string
  update(p: Point, i: number, t: number, ctx: EffectCtx): EffectOutput
}

const TAU = Math.PI * 2

function reducedScale(ctx: EffectCtx): number {
  return ctx.reduced ? 0.25 : 1
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

// 1. Ripple Pulse — concentric ring expanding from viewport center every 3s.
const ripplePulse: Effect = {
  name: 'ripple-pulse',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2
    const cy = ctx.vh / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const cycle = 3.0
    const speed = Math.max(ctx.vw, ctx.vh) / cycle * 0.6
    const phase = (t % cycle) * speed
    const sigma = 80
    const env = Math.exp(-((dist - phase) ** 2) / (2 * sigma * sigma))
    const safe = Math.max(dist, 0.001)
    const amp = 8 * reducedScale(ctx) * env
    const ux = dx / safe
    const uy = dy / safe
    return { ox: ux * amp, oy: uy * amp, f: env * 0.5 }
  },
}

// 2. Wave Left → Right — y-axis sinusoid traveling rightward.
const waveLR: Effect = {
  name: 'wave-lr',
  update(p, _i, t, ctx) {
    const lambda = 220
    const speed = 180
    const amp = 6 * reducedScale(ctx)
    const phase = (p.x - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    return { ox: 0, oy: s * amp, f: clamp01((s + 1) * 0.2) }
  },
}

// 3. Wave Top → Bottom — x-axis sinusoid traveling downward.
const waveTB: Effect = {
  name: 'wave-tb',
  update(p, _i, t, ctx) {
    const lambda = 220
    const speed = 180
    const amp = 6 * reducedScale(ctx)
    const phase = (p.y - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    return { ox: s * amp, oy: 0, f: clamp01((s + 1) * 0.2) }
  },
}

// 4. Diagonal Wave — sweep from NW to SE.
const diagonalWave: Effect = {
  name: 'diagonal-wave',
  update(p, _i, t, ctx) {
    const lambda = 260
    const speed = 200
    const amp = 5 * reducedScale(ctx)
    const phase = (p.x + p.y - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    return { ox: s * amp, oy: c * amp, f: clamp01((s + 1) * 0.2) }
  },
}

// Effects 5–10 added in later tasks.
export const EFFECTS: Effect[] = [
  ripplePulse,
  waveLR,
  waveTB,
  diagonalWave,
]

export function pickEffect(): number {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const fx = params.get('fx')
    if (fx !== null) {
      const n = parseInt(fx, 10)
      if (Number.isInteger(n) && n >= 0 && n < EFFECTS.length) return n
    }
  }
  return Math.floor(Math.random() * EFFECTS.length)
}
```

- [ ] **Step 4: Run test, expect FAIL on length**

Run: `cd d:/SmoothScroll/landing && npm test -- --run lib/ambientEffects.test.ts`
Expected: FAIL — `expect(EFFECTS).toHaveLength(10)` because we only registered 4.

This is the correct progression: tests pin the contract, we add effects until they pass.

- [ ] **Step 5: Commit**

```bash
git add landing/lib/ambientEffects.ts landing/lib/ambientEffects.test.ts
git commit -m "feat(landing): scaffold ambient effects (4/10) — ripple, waves"
```

---

## Task 2: Effects 5–7 (twinkle, heartbeat, breathing — glow-only)

**Files:**
- Modify: `landing/lib/ambientEffects.ts`

- [ ] **Step 1: Add three glow-only effects**

Append to `ambientEffects.ts` ABOVE the `EFFECTS` array:

```ts
// 5. Twinkle Stars — per-dot phase from index hash; ~peaky sine for sparkle.
function hash01(i: number): number {
  // Simple xorshift-style hash → [0,1)
  let x = (i + 1) * 374761393
  x = (x ^ (x >>> 15)) * 1103515245
  x = (x ^ (x >>> 13)) * 1597334677
  x = x ^ (x >>> 16)
  return ((x >>> 0) % 1000) / 1000
}

const twinkleStars: Effect = {
  name: 'twinkle',
  update(_p, i, t, _ctx) {
    const phase = hash01(i) * TAU
    const s = Math.sin(2 * t + phase)
    const peak = Math.max(0, s) ** 4
    return { ox: 0, oy: 0, f: peak * 0.6 }
  },
}

// 6. Heartbeat — global double-pulse "lub-dub" on a 1s cycle.
const heartbeat: Effect = {
  name: 'heartbeat',
  update(_p, _i, t, _ctx) {
    const cycle = 1.0
    const x = (t % cycle) / cycle
    let v = 0
    if (x < 0.12) v = Math.sin((x / 0.12) * Math.PI)
    else if (x < 0.18) v = 0
    else if (x < 0.30) v = Math.sin(((x - 0.18) / 0.12) * Math.PI) * 0.7
    return { ox: 0, oy: 0, f: v * 0.5 }
  },
}

// 7. Slow Breathing — global sine pulse over 6s.
const slowBreathing: Effect = {
  name: 'breathing',
  update(_p, _i, t, _ctx) {
    const v = (Math.sin((TAU * t) / 6) + 1) / 2
    return { ox: 0, oy: 0, f: v * 0.4 }
  },
}
```

Update the array:

```ts
export const EFFECTS: Effect[] = [
  ripplePulse,
  waveLR,
  waveTB,
  diagonalWave,
  twinkleStars,
  heartbeat,
  slowBreathing,
]
```

- [ ] **Step 2: Run test, expect FAIL still on length (7 not 10)**

Run: `cd d:/SmoothScroll/landing && npm test -- --run lib/ambientEffects.test.ts`
Expected: FAIL — `expect(EFFECTS).toHaveLength(10)` still wrong, 7 added of 10.

- [ ] **Step 3: Commit**

```bash
git add landing/lib/ambientEffects.ts
git commit -m "feat(landing): add twinkle/heartbeat/breathing ambient effects (7/10)"
```

---

## Task 3: Effects 8–10 (drift, comet, galaxy)

**Files:**
- Modify: `landing/lib/ambientEffects.ts`

- [ ] **Step 1: Add three motion effects**

Append above `EFFECTS`:

```ts
// 8. Floating Drift — Perlin-ish 2D drift via separable sines.
const floatingDrift: Effect = {
  name: 'drift',
  update(p, _i, t, ctx) {
    const amp = 4 * reducedScale(ctx)
    const ox = Math.sin(p.x * 0.012 + 0.3 * t) * amp
    const oy = Math.cos(p.y * 0.012 + 0.4 * t + 0.7) * amp
    return { ox, oy, f: 0.15 }
  },
}

// 9. Wandering Comet — Lissajous path; nearby dots glow + nudge toward it.
const COMET_RADIUS = 180
const wanderingComet: Effect = {
  name: 'comet',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2 + Math.sin(t * 0.41) * (ctx.vw * 0.4)
    const cy = ctx.vh / 2 + Math.sin(t * 0.27 + 1.3) * (ctx.vh * 0.4)
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= COMET_RADIUS) return { ox: 0, oy: 0, f: 0 }
    const k = 1 - dist / COMET_RADIUS
    const safe = Math.max(dist, 0.001)
    const pull = k * 3 * reducedScale(ctx)
    return { ox: -(dx / safe) * pull, oy: -(dy / safe) * pull, f: k * 0.7 }
  },
}

// 10. Galaxy Spin — each dot rotates around viewport center, ω falls off with r.
const galaxySpin: Effect = {
  name: 'galaxy',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2
    const cy = ctx.vh / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r < 1) return { ox: 0, oy: 0, f: 0.05 }
    const omega = 0.25 / (1 + r / 200)
    const angle = omega * t * reducedScale(ctx)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    return { ox: rx - dx, oy: ry - dy, f: 0.2 }
  },
}
```

Update array:

```ts
export const EFFECTS: Effect[] = [
  ripplePulse,
  waveLR,
  waveTB,
  diagonalWave,
  twinkleStars,
  heartbeat,
  slowBreathing,
  floatingDrift,
  wanderingComet,
  galaxySpin,
]
```

- [ ] **Step 2: Run test, expect PASS**

Run: `cd d:/SmoothScroll/landing && npm test -- --run lib/ambientEffects.test.ts`
Expected: all tests PASS (10 effects, all return finite bounded values, reduced shrinks displacement).

- [ ] **Step 3: If any test fails, fix the math before continuing**

Common failures and fixes:
- `f > 1` → wrap in `clamp01()`.
- `ox > 20` → reduce amplitude constant.
- `NaN` for galaxy → add `r < 1` guard (already in code above).

- [ ] **Step 4: Commit**

```bash
git add landing/lib/ambientEffects.ts
git commit -m "feat(landing): complete 10 ambient effects (drift/comet/galaxy)"
```

---

## Task 4: Wire ambient into BackgroundDotGrid

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

- [ ] **Step 1: Add imports + effect selection at module load**

Replace the import block at the top of `BackgroundDotGrid.tsx`:

```ts
'use client'

import { useEffect, useRef } from 'react'
import {
  buildGrid,
  falloff,
  lerpRgba,
  parseHslVar,
  type Point,
  type Rgba,
} from '@/lib/dotGrid'
import { EFFECTS, pickEffect } from '@/lib/ambientEffects'
```

- [ ] **Step 2: Inside useEffect, pick the active effect once and capture start time**

Find the line `const noHover = window.matchMedia('(hover: none)').matches` and right BELOW the existing `animate` definition, add:

```ts
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const activeEffect = EFFECTS[pickEffect()]
    const startTime = performance.now()
    const effectCtx = { vw: 0, vh: 0, reduced }
```

Then inside `resize()` after grid rebuild, also update effectCtx:

```ts
      effectCtx.vw = viewW
      effectCtx.vh = viewH
```

- [ ] **Step 3: Compose ambient offset into drawFrame**

Replace the inner loop body of `drawFrame` (the `for (let i = 0; i < grid.length; i++)` block) with the version that adds ambient. Locate this section:

```ts
      for (let i = 0; i < grid.length; i++) {
        const p = grid[i]
        const dx = p.x - currentX
        const dy = p.y - currentY
```

Replace ONLY the lines that compute `drawX, drawY, color, radius, shadow` and the final draw — keeping the magnet target/lerp logic intact. The full new loop body (use this as exact replacement):

```ts
      const t = (performance.now() - startTime) / 1000

      for (let i = 0; i < grid.length; i++) {
        const p = grid[i]
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Magnet target offset and lit factor.
        let tOffX = 0
        let tOffY = 0
        let tF = 0
        if (intensity > INTENSITY_THRESHOLD && dist < INFLUENCE_RADIUS) {
          tF = falloff(dist, INFLUENCE_RADIUS) * intensity
          const safeDist = Math.max(dist, 0.001)
          if (dist < INNER_RADIUS) {
            const pushT = (1 - dist / INNER_RADIUS) * intensity
            const disp = pushT * MAX_PUSH
            tOffX = (dx / safeDist) * disp
            tOffY = (dy / safeDist) * disp
          } else {
            const disp = tF * MAX_PULL
            tOffX = -(dx / safeDist) * disp
            tOffY = -(dy / safeDist) * disp
          }
        }

        const idx = i * 3
        dotState[idx]     += (tOffX - dotState[idx])     * DOT_LERP
        dotState[idx + 1] += (tOffY - dotState[idx + 1]) * DOT_LERP
        dotState[idx + 2] += (tF    - dotState[idx + 2]) * DOT_LERP

        const ambient = activeEffect.update(p, i, t, effectCtx)
        const ox = dotState[idx]     + ambient.ox
        const oy = dotState[idx + 1] + ambient.oy
        const fMagnet = dotState[idx + 2]
        const f = Math.max(fMagnet, ambient.f)

        if (
          Math.abs(tOffX - dotState[idx]) > SETTLE_THRESHOLD ||
          Math.abs(tOffY - dotState[idx + 1]) > SETTLE_THRESHOLD ||
          Math.abs(tF - fMagnet) > F_THRESHOLD
        ) {
          stillMoving = true
        }

        if (f < F_THRESHOLD) {
          if (shadowOn) {
            ctx.shadowBlur = 0
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = staticStyle
            shadowOn = false
          }
          ctx.beginPath()
          ctx.arc(p.x + ox, p.y + oy, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        const color = lerpRgba(theme.staticColor, theme.brandColor, f)
        ctx.shadowBlur = MAX_SHADOW_BLUR * f
        ctx.shadowColor = shadowColor
        ctx.fillStyle = rgbaToFillStyle(color)
        shadowOn = true

        ctx.beginPath()
        ctx.arc(p.x + ox, p.y + oy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
```

- [ ] **Step 4: Force rAF to always run (ambient is continuous)**

Find the end of `tick()`:

```ts
      if (cursorSettling || stillMoving || intensitySettling) {
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = 0
        if (intensity === 0) drawStatic()
      }
```

Replace with:

```ts
      // Ambient is always animating; never park rAF.
      rafId = requestAnimationFrame(tick)
```

- [ ] **Step 5: Kick rAF on mount (don't wait for mousemove)**

Right after `resize()` and `drawStatic()` calls inside `useEffect`, add:

```ts
    kick()
```

- [ ] **Step 6: Build to catch type errors**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: build succeeds, no TS errors.

If TS complains about unused `drawStatic`, that's fine — it's still called from resize/theme handlers. If it complains about anything else, fix before continuing.

- [ ] **Step 7: Smoke test in browser**

Server already running on port 3001 (or restart with `npx http-server out -p 3001 -s`).
Open `http://localhost:3001/en/?fx=0` in incognito → ripple pulse should be visible.
Try `?fx=5` (twinkle), `?fx=8` (drift), `?fx=9` (comet) — should each look distinct.
Rê chuột → magnet still works on top of ambient.

- [ ] **Step 8: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "feat(landing): wire 10 ambient effects into dot grid"
```

---

## Task 5: E2E smoke test

**Files:**
- Create: `landing/e2e/dot-grid-ambient.spec.ts`

- [ ] **Step 1: Write smoke test**

```ts
// landing/e2e/dot-grid-ambient.spec.ts
import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001'

test.use({ baseURL: BASE, viewport: { width: 1280, height: 800 } })

for (let fx = 0; fx < 10; fx++) {
  test(`ambient effect ${fx} produces motion over time`, async ({ page }) => {
    await page.goto(`/en/?fx=${fx}`, { waitUntil: 'networkidle' })

    const sample = async () => {
      return await page.evaluate(() => {
        const c = document.querySelector('canvas[aria-hidden="true"]') as HTMLCanvasElement
        const ctx = c.getContext('2d')!
        // Hash the entire frame content into a small fingerprint.
        const data = ctx.getImageData(0, 0, c.width, c.height).data
        let hash = 0
        for (let i = 0; i < data.length; i += 4 * 97) {
          hash = (hash * 31 + data[i] + data[i + 1] * 256 + data[i + 2] * 65536) | 0
        }
        return hash
      })
    }

    const a = await sample()
    await page.waitForTimeout(700)
    const b = await sample()

    // Different frames should hash differently for animated content.
    expect(a, `effect ${fx}: frame fingerprint must change between samples`).not.toBe(b)
  })
}
```

- [ ] **Step 2: Ensure server is up and run test**

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test e2e/dot-grid-ambient.spec.ts --reporter=line`
Expected: all 10 tests pass.

- [ ] **Step 3: If any effect fails (frames identical), check that effect's math**

Hint: glow-only effects (twinkle/heartbeat/breathing) still change `f` over time → pixel values change → fingerprint differs. If one fails, the effect math is broken or the rAF loop isn't running.

- [ ] **Step 4: Commit**

```bash
git add landing/e2e/dot-grid-ambient.spec.ts
git commit -m "test(landing): smoke test all 10 ambient effects"
```

---

## Task 6: Final verify + cleanup

- [ ] **Step 1: Run full unit test suite**

Run: `cd d:/SmoothScroll/landing && npm test -- --run`
Expected: dotGrid + ambientEffects tests all pass.

- [ ] **Step 2: Run all e2e tests**

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=list`
Expected: dot-grid-overlay (light + dark), dot-grid-reduced-motion, dot-grid-ambient (10 specs) all pass.

- [ ] **Step 3: Final build**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: success.

- [ ] **Step 4: Visual sanity in incognito**

Reload `http://localhost:3001/en/` (no `?fx`) several times — each load should pick a random effect (different visuals).

- [ ] **Step 5: Tag the work**

```bash
git log --oneline -8
```

If everything looks good, the feature is ready. Don't push — wait for user confirmation.

---

## Self-Review Notes

- **Spec coverage:** Every effect from the spec table appears in Task 1/2/3. Reduced-motion handling lives inside each effect. Random selection + `?fx=` override in Task 1. Wiring into `drawFrame` and always-on rAF in Task 4. E2E smoke in Task 5.
- **No placeholders:** Every code block is complete and copy-pasteable. No "TODO" or "similar to above" — Task 4's loop body is fully repeated even though it overlaps with current code.
- **Type consistency:** `Effect`, `EffectCtx`, `EffectOutput` defined once in Task 1, used unchanged in Tasks 2/3/4. `pickEffect` signature stable. `EFFECTS` array grows monotonically.
- **TDD shape:** Tests in Task 1 fix the contract before any effect math is finalized. Tasks 2/3 add to the registry and the same test passes when count hits 10.
