# Dot Grid Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut per-frame CPU/GPU 3-5x on the dot grid background while preserving (or improving) visual quality.

**Architecture:** All four optimizations land in a single file (`BackgroundDotGrid.tsx`). Replace per-dot Canvas2D shadows with a pre-rendered radial-gradient sprite, batch all static dots into one `Path2D` fill, throttle `document.elementFromPoint` to rAF cadence, and cap effective DPR by viewport pixel budget.

**Tech Stack:** TypeScript, React 18, HTML5 Canvas 2D (drawImage, Path2D), existing Vitest + Playwright suites.

**Spec:** [docs/superpowers/specs/2026-05-19-dot-grid-perf-design.md](../specs/2026-05-19-dot-grid-perf-design.md)

---

## File Structure

Single file changes, each task a self-contained edit:

| File | Responsibility |
|---|---|
| `landing/components/BackgroundDotGrid.tsx` | All 4 optimizations |

No new files. Sprite canvas is a local variable inside `useEffect`, rebuilt on theme change.

## Regression contract

These existing e2e tests are the regression suite — they assert pixel-level behavior and must keep passing after each task:

- `landing/e2e/dot-grid-overlay.spec.ts` — dots present, cursor lights pixels (5x), brand-blue shift (≥80) for both light + dark themes.
- `landing/e2e/dot-grid-reduced-motion.spec.ts` — magnet still works under reduced motion.
- `landing/e2e/dot-grid-ambient.spec.ts` — frame fingerprint changes over time for all 7 effects.
- `landing/e2e/landing.spec.ts` — page-level smoke tests.

All e2e run with `PLAYWRIGHT_BASE_URL=http://localhost:3001` against a static `npm run build` output.

---

## Pre-flight

- [ ] **Step 0: Confirm baseline e2e is green**

Run:
```
cd d:/SmoothScroll/landing && npm run build && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=line
```
Expected: 31 passed.

If a test is already flaky, fix it before starting — perf changes shift pixel exact values and a flaky baseline will fool you.

---

## Task 1: Glow sprite replaces shadowBlur

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

The current lit-dot path sets `ctx.shadowBlur` and `ctx.shadowColor` then calls `arc + fill`. Canvas2D shadows are the slowest paint primitive. We replace with a pre-rendered offscreen canvas containing a radial gradient halo, drawn via `drawImage` with `globalAlpha = f`.

- [ ] **Step 1: Add sprite constants near the other constants**

In `BackgroundDotGrid.tsx`, find the top-of-file constants and add (insert after `OFFSCREEN`):

```ts
const SPRITE_SIZE = 32
const SPRITE_HALF = SPRITE_SIZE / 2
```

- [ ] **Step 2: Add a `buildSprite` helper next to `readThemeColors`**

Insert above `function rgbaToFillStyle`:

```ts
function buildSprite(brand: Rgba): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = SPRITE_SIZE
  c.height = SPRITE_SIZE
  const sctx = c.getContext('2d')
  if (!sctx) return c
  const grad = sctx.createRadialGradient(
    SPRITE_HALF, SPRITE_HALF, 0,
    SPRITE_HALF, SPRITE_HALF, SPRITE_HALF,
  )
  grad.addColorStop(0,    `rgba(${brand.r},${brand.g},${brand.b},1.0)`)
  grad.addColorStop(0.25, `rgba(${brand.r},${brand.g},${brand.b},0.55)`)
  grad.addColorStop(0.6,  `rgba(${brand.r},${brand.g},${brand.b},0.18)`)
  grad.addColorStop(1,    `rgba(${brand.r},${brand.g},${brand.b},0)`)
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  return c
}
```

- [ ] **Step 3: Hold a sprite ref inside useEffect that rebuilds on theme change**

Inside `useEffect`, find the `let theme = readThemeColors()` line. Right after it, add:

```ts
    let sprite = buildSprite(theme.brandColor)
```

Then find the existing `onThemeChange` function:

```ts
    function onThemeChange() {
      theme = readThemeColors()
      if (!animate || rafId === 0) drawStatic()
    }
```

Replace with:

```ts
    function onThemeChange() {
      theme = readThemeColors()
      sprite = buildSprite(theme.brandColor)
      if (!animate || rafId === 0) drawStatic()
    }
```

- [ ] **Step 4: Replace shadowBlur path in drawFrame with sprite drawImage**

Locate this block inside `drawFrame`:

```ts
        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        const color = lerpRgba(theme.staticColor, theme.brandColor, f)
        ctx.shadowBlur = MAX_SHADOW_BLUR * f
        ctx.shadowColor = shadowColor
        ctx.fillStyle = rgbaToFillStyle(color)
        shadowOn = true

        ctx.beginPath()
        ctx.arc(p.x + ox, p.y + oy, radius, 0, Math.PI * 2)
        ctx.fill()
```

Replace with:

```ts
        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        // Sprite halo carries the glow; drawImage scales by spriteScale around the dot.
        const spriteScale = 1.6 + f * 1.8
        const half = SPRITE_HALF * spriteScale
        ctx.globalAlpha = f
        ctx.drawImage(
          sprite,
          p.x + ox - half,
          p.y + oy - half,
          SPRITE_SIZE * spriteScale,
          SPRITE_SIZE * spriteScale,
        )
        ctx.globalAlpha = 1
        // Crisp dot core on top so size feedback still reads.
        ctx.fillStyle = rgbaToFillStyle(lerpRgba(theme.staticColor, theme.brandColor, f))
        ctx.beginPath()
        ctx.arc(p.x + ox, p.y + oy, radius, 0, Math.PI * 2)
        ctx.fill()
```

- [ ] **Step 5: Remove now-dead shadow plumbing in drawFrame**

Inside `drawFrame`, find these two locations and delete them (they are no longer needed):

Top of function:
```ts
      const brand = theme.brandColor
      const shadowColor = `rgba(${brand.r},${brand.g},${brand.b},0.9)`
```
Delete both lines.

Top of function near `let shadowOn = false`:
```ts
      ctx.fillStyle = staticStyle
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
```
Delete the two `shadow*` lines (keep the `fillStyle = staticStyle`).

Inside the static branch:
```ts
        if (!lit || dist >= INFLUENCE_RADIUS) {
          if (shadowOn) {
            ctx.shadowBlur = 0
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = staticStyle
            shadowOn = false
          }
```
Replace the inner `if (shadowOn) { ... }` block with:
```ts
          if (shadowOn) {
            ctx.fillStyle = staticStyle
            shadowOn = false
          }
```

Bottom of function:
```ts
      if (shadowOn) {
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
      }
```
Delete entirely. `shadowOn` flag becomes meaningful only for fillStyle tracking; keep the variable since Task 2 will repurpose it.

Also delete the now-unused `MAX_SHADOW_BLUR` constant at the top of the file:
```ts
const MAX_SHADOW_BLUR = 10
```

- [ ] **Step 6: Build**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: success, no TS errors. If TS warns about unused symbols, delete them.

- [ ] **Step 7: Run e2e regression**

Ensure server up: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/en/` returns 200. If not, restart with `npx http-server out -p 3001 -s` in a background task.

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=line`
Expected: 31 passed.

If a magnet/glow test fails because pixel counts shifted, that is acceptable iff visual is intact — but try not to lower the test thresholds. Adjust `spriteScale` constants instead until the cursor-on assertions still pass with margin.

- [ ] **Step 8: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "perf(landing): replace shadowBlur with pre-rendered glow sprite"
```

---

## Task 2: Path2D batch for static dots

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

Static dots (cursor far + ambient.f below threshold) are 90%+ of dots most frames. Currently each one is `beginPath / arc / fill`. Collect them into one `Path2D` and call `fill(staticPath)` once at end of frame.

- [ ] **Step 1: Refactor static branch to push into a Path2D**

Inside `drawFrame`, find the early-out block for non-lit dots:

```ts
        if (f < F_THRESHOLD) {
          if (shadowOn) {
            ctx.fillStyle = staticStyle
            shadowOn = false
          }
          ctx.beginPath()
          ctx.arc(p.x + ox, p.y + oy, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          continue
        }
```

Replace with (note: `staticPath` is declared above the loop):
```ts
        if (f < F_THRESHOLD) {
          staticPath.moveTo(p.x + ox + DOT_RADIUS, p.y + oy)
          staticPath.arc(p.x + ox, p.y + oy, DOT_RADIUS, 0, Math.PI * 2)
          continue
        }
```

The `moveTo` is needed because `arc` on a fresh subpath connects to the previous point with a line otherwise, drawing junk.

- [ ] **Step 2: Declare staticPath at top of drawFrame and fill it before lit dots**

Find the top of `drawFrame`:

```ts
    function drawFrame(): boolean {
      if (!ctx) return false
      ctx.clearRect(0, 0, viewW, viewH)
      const staticStyle = rgbaToFillStyle(theme.staticColor)
      let stillMoving = false
      let shadowOn = false

      ctx.fillStyle = staticStyle

      const t = (performance.now() - startTime) / 1000
```

Replace with:
```ts
    function drawFrame(): boolean {
      if (!ctx) return false
      ctx.clearRect(0, 0, viewW, viewH)
      const staticStyle = rgbaToFillStyle(theme.staticColor)
      let stillMoving = false
      let shadowOn = false
      const staticPath = new Path2D()

      const t = (performance.now() - startTime) / 1000
```

Then at the very end of the function (right before `return stillMoving`), add:

```ts
      ctx.fillStyle = staticStyle
      ctx.fill(staticPath)

      return stillMoving
    }
```

(Replace the existing `return stillMoving`.)

Order matters: lit dots draw with halo first inside the loop, then we fill static dots over them. That way static cores never disappear under the halo gradient. Actually wait — we want lit halos to glow OVER static dots. So fill static FIRST, then loop draws lit dots on top.

Restructure: the loop currently does both static-add and lit-draw inline. After this task the loop only adds to staticPath OR draws a lit dot. We need to fill the static path at the END of the loop, BEFORE the lit dots? No — the issue is interleaving. Simpler: do TWO passes. Pass 1: build staticPath, draw lit dots into a list. Pass 2: fill static, then draw lit overlay.

Actually cleaner: keep the loop as-is (interleaved), and just `fill(staticPath)` at the END after the loop completes. But because the lit dots are drawn during the loop, the static dots get filled OVER them visually. To avoid that, fill staticPath FIRST then run the loop. But we need to know which dots are lit before we draw any of them — so first pass sets target offsets and computes lit/static, second pass renders.

Decision: do single pass that defers lit drawing into a small array, then in the second pass fill static + draw lit overlay.

Replace the inside of `drawFrame` (after the existing variable declarations and `t = ...` line) with:

```ts
      type LitDot = { x: number; y: number; f: number; radius: number; coreColor: Rgba }
      const lit: LitDot[] = []

      for (let i = 0; i < grid.length; i++) {
        const p = grid[i]
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

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

        const ambient = activeEffect
          ? activeEffect.update(p, i, t, effectCtx)
          : { ox: 0, oy: 0, f: 0 }
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

        const drawX = p.x + ox
        const drawY = p.y + oy

        if (f < F_THRESHOLD) {
          staticPath.moveTo(drawX + DOT_RADIUS, drawY)
          staticPath.arc(drawX, drawY, DOT_RADIUS, 0, Math.PI * 2)
          continue
        }

        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        const coreColor = lerpRgba(theme.staticColor, theme.brandColor, f)
        // Lit dot core also goes into staticPath as a tiny optimization?
        // No — different fillStyle. Keep separate.
        lit.push({ x: drawX, y: drawY, f, radius, coreColor })
      }

      // Fill static dots in one call.
      ctx.fillStyle = staticStyle
      ctx.fill(staticPath)

      // Then draw lit halos + cores on top.
      for (const d of lit) {
        const spriteScale = 1.6 + d.f * 1.8
        const half = SPRITE_HALF * spriteScale
        ctx.globalAlpha = d.f
        ctx.drawImage(
          sprite,
          d.x - half,
          d.y - half,
          SPRITE_SIZE * spriteScale,
          SPRITE_SIZE * spriteScale,
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = rgbaToFillStyle(d.coreColor)
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      return stillMoving
    }
```

This replaces the entire body after the early `if (!ctx) return false` and the variable declarations. Make sure the function still ends with the closing `}` of `drawFrame`.

Note: `shadowOn` flag is now unused — delete its `let shadowOn = false` declaration too.

- [ ] **Step 3: Build**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: success.

- [ ] **Step 4: Run e2e regression**

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=line`
Expected: 31 passed.

- [ ] **Step 5: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "perf(landing): batch static dots into one Path2D fill"
```

---

## Task 3: Throttle elementFromPoint to rAF

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

Currently `onMove` calls `isOverContent` (which calls `document.elementFromPoint`) on every mousemove (~100Hz Chrome). Move that call into `tick()` so it runs ≤60Hz aligned with rAF.

- [ ] **Step 1: Add pending coords + dirty flag**

Inside `useEffect`, find the cursor state declarations:

```ts
    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let targetIntensity = 0
    let intensity = 0
    let rafId = 0
```

Replace with:

```ts
    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let targetIntensity = 0
    let intensity = 0
    let rafId = 0
    let pendingX = OFFSCREEN
    let pendingY = OFFSCREEN
    let pendingDirty = false
    let pendingLeave = false
```

- [ ] **Step 2: Slim down onMove and onLeave**

Replace `onMove` and `onLeave`:

```ts
    function onMove(e: MouseEvent) {
      pendingX = e.clientX
      pendingY = e.clientY
      pendingDirty = true
      kick()
    }

    function onLeave() {
      pendingLeave = true
      kick()
    }
```

- [ ] **Step 3: Drain pending input at top of tick()**

Replace `tick`:

```ts
    function tick() {
      if (pendingLeave) {
        targetIntensity = 0
        pendingLeave = false
      }
      if (pendingDirty) {
        const overContent = isOverContent(pendingX, pendingY)
        targetX = pendingX
        targetY = pendingY
        if (currentX === OFFSCREEN) {
          currentX = targetX
          currentY = targetY
        }
        targetIntensity = overContent ? 0 : 1
        pendingDirty = false
      }
      currentX += (targetX - currentX) * CURSOR_LERP
      currentY += (targetY - currentY) * CURSOR_LERP
      intensity += (targetIntensity - intensity) * INTENSITY_LERP
      if (Math.abs(targetIntensity - intensity) < INTENSITY_THRESHOLD) {
        intensity = targetIntensity
      }
      drawFrame()
      rafId = requestAnimationFrame(tick)
    }
```

- [ ] **Step 4: Build**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: success.

- [ ] **Step 5: Run e2e regression**

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=line`
Expected: 31 passed.

Playwright's mouse move sequence still triggers tick on next frame, so cursor-on assertion still gets a chance to update before `waitForTimeout` fires.

- [ ] **Step 6: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "perf(landing): throttle elementFromPoint to rAF cadence"
```

---

## Task 4: DPR floor cap

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

Cap effective DPR by a 6M-pixel backing-store budget so 4K monitors don't pay 33M-pixel paint cost.

- [ ] **Step 1: Replace dpr calc in resize()**

Find inside `resize()`:

```ts
      dpr = Math.min(window.devicePixelRatio || 1, 2)
```

Replace with:

```ts
      const rawDpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelBudget = 6_000_000
      const wouldBe = viewW * viewH * rawDpr * rawDpr
      dpr = wouldBe > pixelBudget && viewW * viewH > 0
        ? Math.max(1, Math.sqrt(pixelBudget / (viewW * viewH)))
        : rawDpr
```

- [ ] **Step 2: Build**

Run: `cd d:/SmoothScroll/landing && npm run build`
Expected: success.

- [ ] **Step 3: Run e2e regression**

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=line`
Expected: 31 passed. Playwright runs at 1280×800 so DPR is unchanged from prior config (1280×800×4 = 4.1M < 6M budget).

- [ ] **Step 4: Commit**

```bash
git add landing/components/BackgroundDotGrid.tsx
git commit -m "perf(landing): cap effective DPR by viewport pixel budget"
```

---

## Task 5: Final verify

- [ ] **Step 1: Full unit + e2e suite**

Run: `cd d:/SmoothScroll/landing && npm test -- --run`
Expected: 30 passed (5 files).

Run: `cd d:/SmoothScroll/landing && PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --reporter=list`
Expected: 31 passed.

- [ ] **Step 2: Manual visual sanity**

Open `http://localhost:3001/en/` in incognito (hard reload). Reload several times to cycle through the 7 ambient effects. Verify:
- Static dots visible everywhere.
- Cursor halo glows brand-blue with smooth gradient (no harder-edged shadow).
- Ambient effects animate at 60fps (open DevTools → Performance recorder for 5s; verify rAF callbacks land within budget).
- Magnet still pulls/pushes dots near cursor.
- Cursor over text/buttons → ambient still runs, magnet fades out.

If anything looks regressed, document what differs and stop — don't tune `spriteScale` or sprite gradient stops without confirming the regression is real.

- [ ] **Step 3: Optional perf measurement**

In DevTools Performance, record 5s of idle. Average `Animation Frame Fired` task length should be measurably lower than the pre-task-1 baseline. If you stash a baseline trace before Task 1, attach a side-by-side note to the final commit message.

- [ ] **Step 4: Don't push**

Wait for user to confirm the perf and visuals locally before any push.

---

## Self-Review Notes

- **Spec coverage:** 4 spec optimizations → 4 tasks (1:1). Acceptance criterion (e2e green) verified after each task.
- **No placeholders:** Every step lists exact file path, exact code blocks, exact commands. The big body replacement in Task 2 Step 2 includes the full new function body to avoid ambiguity about interleaving.
- **Type consistency:** `LitDot` defined locally in Task 2; `pendingX/pendingY/pendingDirty/pendingLeave` defined in Task 3 and used only in Task 3 (not referenced earlier). `sprite` defined in Task 1 and used in Task 1 + Task 2 (drawImage call). `staticPath` defined in Task 2 only. `MAX_SHADOW_BLUR` removed in Task 1.
- **TDD shape:** No new behavior is added — these are perf refactors. The existing e2e suite IS the failing-test contract: each task runs the suite and must keep all 31 green. New unit tests would add cost without value because the visual contract is what matters.
