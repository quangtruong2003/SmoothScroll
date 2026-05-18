# Cursor Repulsion Dot Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failing CSS lit-dots cursor effect in `landing/` with a Canvas 2D repulsion effect: dots within 220px of the cursor get pushed away (max 14px) and lerp toward the brand color.

**Architecture:** Single client component (`BackgroundDotGrid.tsx`) hosting one `<canvas>` fixed full-screen. Pure helpers (color parsing, falloff math, grid build) extracted to `landing/lib/dotGrid.ts` so they're unit-testable. The component wires up theme reads, listeners, and the rAF loop. All four old CSS classes are deleted.

**Tech Stack:** Next.js 15 App Router (static export), React 18, Canvas 2D API, Vitest (already configured in `landing/`).

**Spec:** [`docs/superpowers/specs/2026-05-19-cursor-repulsion-dot-grid-design.md`](../specs/2026-05-19-cursor-repulsion-dot-grid-design.md)

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `landing/lib/dotGrid.ts` | Pure helpers: parseHslVar, lerpRgba, falloff, buildGrid | Create |
| `landing/lib/dotGrid.test.ts` | Unit tests for above | Create |
| `landing/components/BackgroundDotGrid.tsx` | Canvas component, listeners, rAF loop | Rewrite |
| `landing/app/globals.css` | Delete `.bg-dot-grid`, `.bg-dot-cursor`, `.bg-dot-bloom`, `.bg-dot-grid-glow` | Modify |

---

## Task 1: Pure helper module + tests

**Files:**
- Create: `landing/lib/dotGrid.ts`
- Create: `landing/lib/dotGrid.test.ts`

- [ ] **Step 1: Write failing tests**

`landing/lib/dotGrid.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseHslVar, lerpRgba, falloff, buildGrid, type Rgba } from './dotGrid'

describe('parseHslVar', () => {
  it('parses standard "H S% L%" string', () => {
    expect(parseHslVar('220 90% 65%', 1)).toEqual({ r: 122, g: 156, b: 245, a: 1 })
  })

  it('applies provided alpha', () => {
    const c = parseHslVar('0 0% 0%', 0.14)
    expect(c.a).toBeCloseTo(0.14, 5)
    expect(c.r).toBe(0)
  })

  it('falls back to neutral gray on malformed input', () => {
    expect(parseHslVar('not-a-color', 1)).toEqual({ r: 128, g: 128, b: 128, a: 1 })
  })
})

describe('lerpRgba', () => {
  const a: Rgba = { r: 0, g: 0, b: 0, a: 0.1 }
  const b: Rgba = { r: 255, g: 255, b: 255, a: 1 }

  it('returns first color when t=0', () => {
    expect(lerpRgba(a, b, 0)).toEqual(a)
  })

  it('returns second color when t=1', () => {
    expect(lerpRgba(a, b, 1)).toEqual(b)
  })

  it('mixes channels at t=0.5', () => {
    const m = lerpRgba(a, b, 0.5)
    expect(m.r).toBe(128)
    expect(m.a).toBeCloseTo(0.55, 5)
  })
})

describe('falloff', () => {
  it('returns 0 at or beyond radius', () => {
    expect(falloff(220, 220)).toBe(0)
    expect(falloff(500, 220)).toBe(0)
  })

  it('returns 1 at distance 0', () => {
    expect(falloff(0, 220)).toBe(1)
  })

  it('is quadratic: half-distance gives 0.25', () => {
    expect(falloff(110, 220)).toBeCloseTo(0.25, 5)
  })
})

describe('buildGrid', () => {
  it('covers viewport with one-cell margin on every side', () => {
    const grid = buildGrid(44, 44, 22)
    // x: -22, 0, 22, 44, 66 => 5 cols
    // y: -22, 0, 22, 44, 66 => 5 rows
    expect(grid.length).toBe(25)
    expect(grid[0]).toEqual({ x: -22, y: -22 })
  })

  it('handles non-multiple viewport sizes', () => {
    const grid = buildGrid(50, 50, 22)
    // x ends at 66 (>=50+22). 5 cols, 5 rows.
    expect(grid.length).toBe(25)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd landing && npx vitest run lib/dotGrid.test.ts
```
Expected: all 4 describe blocks fail with "Cannot find module './dotGrid'".

- [ ] **Step 3: Implement `landing/lib/dotGrid.ts`**

```ts
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Point {
  x: number
  y: number
}

const NEUTRAL: Rgba = { r: 128, g: 128, b: 128, a: 1 }

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100
  const lNorm = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) =>
    lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

export function parseHslVar(value: string, alpha: number): Rgba {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/)
  if (!match) return { ...NEUTRAL, a: alpha }
  const h = Number(match[1])
  const s = Number(match[2])
  const l = Number(match[3])
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) {
    return { ...NEUTRAL, a: alpha }
  }
  const { r, g, b } = hslToRgb(h, s, l)
  return { r, g, b, a: alpha }
}

export function lerpRgba(a: Rgba, b: Rgba, t: number): Rgba {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: a.a + (b.a - a.a) * t,
  }
}

export function falloff(distance: number, radius: number): number {
  if (distance >= radius) return 0
  const t = 1 - distance / radius
  return t * t
}

export function buildGrid(width: number, height: number, gap: number): Point[] {
  const points: Point[] = []
  for (let y = -gap; y <= height + gap; y += gap) {
    for (let x = -gap; x <= width + gap; x += gap) {
      points.push({ x, y })
    }
  }
  return points
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd landing && npx vitest run lib/dotGrid.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add landing/lib/dotGrid.ts landing/lib/dotGrid.test.ts
git commit -m "feat(landing): add pure helpers for cursor repulsion dot grid"
```

---

## Task 2: Rewrite BackgroundDotGrid component

**Files:**
- Modify (full rewrite): `landing/components/BackgroundDotGrid.tsx`

- [ ] **Step 1: Replace the file's entire contents**

```tsx
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

const GAP = 22
const DOT_RADIUS = 1.0
const INFLUENCE_RADIUS = 220
const MAX_PUSH = 14
const LERP_FACTOR = 0.18
const SETTLE_THRESHOLD = 0.3
const STATIC_ALPHA = 0.14
const OFFSCREEN = -10000

interface ThemeColors {
  staticColor: Rgba
  brandColor: Rgba
}

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement)
  const fg = styles.getPropertyValue('--foreground').trim()
  const isDark =
    document.documentElement.classList.contains('dark') ||
    (!document.documentElement.classList.contains('light') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  const brandRaw = isDark ? '220 100% 78%' : styles.getPropertyValue('--brand-from').trim()
  return {
    staticColor: parseHslVar(fg, STATIC_ALPHA),
    brandColor: parseHslVar(brandRaw, 1),
  }
}

function rgbaToFillStyle(c: Rgba): string {
  return `rgba(${c.r},${c.g},${c.b},${c.a})`
}

export function BackgroundDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    const animate = !reduced && !noHover

    let grid: Point[] = []
    let viewW = 0
    let viewH = 0
    let dpr = 1
    let theme = readThemeColors()

    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let rafId = 0

    function resize() {
      if (!canvas || !ctx) return
      viewW = window.innerWidth
      viewH = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewW * dpr)
      canvas.height = Math.floor(viewH * dpr)
      canvas.style.width = `${viewW}px`
      canvas.style.height = `${viewH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      grid = buildGrid(viewW, viewH, GAP)
    }

    function drawStatic() {
      if (!ctx) return
      ctx.clearRect(0, 0, viewW, viewH)
      ctx.fillStyle = rgbaToFillStyle(theme.staticColor)
      for (const p of grid) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawFrame() {
      if (!ctx) return
      ctx.clearRect(0, 0, viewW, viewH)
      const staticStyle = rgbaToFillStyle(theme.staticColor)
      let stillMoving = false

      for (const p of grid) {
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist >= INFLUENCE_RADIUS) {
          ctx.fillStyle = staticStyle
          ctx.beginPath()
          ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const f = falloff(dist, INFLUENCE_RADIUS)
        const safeDist = Math.max(dist, 0.001)
        const push = f * MAX_PUSH
        const drawX = p.x + (dx / safeDist) * push
        const drawY = p.y + (dy / safeDist) * push
        const color = lerpRgba(theme.staticColor, theme.brandColor, f)

        ctx.fillStyle = rgbaToFillStyle(color)
        ctx.beginPath()
        ctx.arc(drawX, drawY, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        if (push > SETTLE_THRESHOLD) stillMoving = true
      }

      return stillMoving
    }

    function tick() {
      currentX += (targetX - currentX) * LERP_FACTOR
      currentY += (targetY - currentY) * LERP_FACTOR
      const stillMoving = drawFrame()
      const cursorSettling =
        Math.abs(targetX - currentX) > SETTLE_THRESHOLD ||
        Math.abs(targetY - currentY) > SETTLE_THRESHOLD
      if (cursorSettling || stillMoving) {
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = 0
      }
    }

    function kick() {
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    function onMove(e: MouseEvent) {
      targetX = e.clientX
      targetY = e.clientY
      if (currentX === OFFSCREEN) {
        currentX = targetX
        currentY = targetY
      }
      kick()
    }

    function onLeave() {
      targetX = OFFSCREEN
      targetY = OFFSCREEN
      kick()
    }

    function onResize() {
      resize()
      if (animate && rafId === 0) drawStatic()
      else if (!animate) drawStatic()
    }

    function onThemeChange() {
      theme = readThemeColors()
      if (!animate || rafId === 0) drawStatic()
    }

    resize()
    drawStatic()

    if (animate) {
      window.addEventListener('mousemove', onMove, { passive: true })
      document.addEventListener('mouseleave', onLeave)
    }
    window.addEventListener('resize', onResize)

    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    colorSchemeQuery.addEventListener('change', onThemeChange)

    const observer = new MutationObserver(onThemeChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      if (animate) {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
      }
      window.removeEventListener('resize', onResize)
      colorSchemeQuery.removeEventListener('change', onThemeChange)
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd landing && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "feat(landing): canvas-based cursor repulsion dot grid"
```

---

## Task 3: Remove dead CSS

**Files:**
- Modify: `landing/app/globals.css` — delete `.bg-dot-grid`, `.bg-dot-cursor`, `.bg-dot-bloom`, `.bg-dot-grid-glow` rules and their dark-mode overrides

- [ ] **Step 1: Delete the dot-grid CSS**

In `landing/app/globals.css`, delete every rule from `.bg-dot-grid {` (around line 102) through the closing brace of the `@media (hover: none), (prefers-reduced-motion: reduce) { .bg-dot-cursor { display: none; } }` block (around line 181). Leave the surrounding `@layer components { ... }` wrapper intact — only its dot-grid contents go.

After deletion the `@layer components { }` block can be empty; that's fine. Do not touch any other rules.

- [ ] **Step 2: Verify the four classes are gone**

```bash
cd landing && grep -nE "bg-dot-grid|bg-dot-cursor|bg-dot-bloom|bg-dot-grid-glow" app/globals.css
```
Expected: no matches.

- [ ] **Step 3: Verify no other file still references the deleted classes**

```bash
cd landing && grep -rnE "bg-dot-grid|bg-dot-cursor|bg-dot-bloom|bg-dot-grid-glow" app components --include="*.tsx" --include="*.ts" --include="*.css"
```
Expected: no matches. (The old `BackgroundDotGrid.tsx` referenced these — Task 2 already replaced the whole file.)

- [ ] **Step 4: Commit**

```bash
git add landing/app/globals.css
git commit -m "chore(landing): drop unused dot-grid CSS classes"
```

---

## Task 4: Production build + manual visual verification

**Files:** none changed in this task.

- [ ] **Step 1: Build**

```bash
cd landing && npm run build
```
Expected: build succeeds, `out/` directory generated.

- [ ] **Step 2: Serve locally**

```bash
cd landing && npx serve out -p 3001
```
Leave running.

- [ ] **Step 3: Manual visual verification at `http://localhost:3001/en/`**

User must visually confirm in Chrome:
- [ ] Move cursor across viewport: dots within ~220px push outward and tint blue; dots beyond stay static gray.
- [ ] Stop moving: dots spring back to grid position smoothly (~0.5s).
- [ ] Move cursor offscreen: all dots return to base; in DevTools Performance panel during idle, no rAF callbacks fire.
- [ ] Toggle OS theme (Settings → light/dark): brand color updates without reload.
- [ ] DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`: effect disabled, static grid still visible.
- [ ] Resize window: grid rebuilds, no clipped edges.

If any check fails, do NOT commit further. Report which check failed and stop for triage.

- [ ] **Step 4: Final commit (only after user confirms all checks pass)**

User says "all checks pass" → no further commits needed; the implementation is complete and was committed across Tasks 1-3.

---

## Notes for the engineer

- The repo's git status currently has ~24 unrelated modified files (favicons, basePath refactor, hydration fix). Do NOT include those in any commit you make for this plan — stage only the files this plan touches.
- `next dev` OOMs on this machine. Always verify via `npm run build && npx serve out -p 3001`.
- The `landing/` directory uses `@/` alias for `landing/`. The import `from '@/lib/dotGrid'` in Task 2 is correct.
