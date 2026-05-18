# Cursor Repulsion Dot Grid — Design Spec

**Date:** 2026-05-19
**Scope:** `landing/` (Next.js 15 static export landing page)
**Status:** Approved by user, ready for implementation plan

## Goal

Replace the current "lit-up dots" cursor effect with a **physical repulsion** effect inspired by [antigravity.google](https://antigravity.google/): dots near the cursor are pushed away as if the cursor were a magnetic same-pole, while dots farther away stay still. Dots inside the influence radius also lerp toward the brand color.

## User-Approved Decisions

| Question | Answer |
|---|---|
| Effect type | **Repulsion** — dots near cursor pushed away |
| Color behavior | **Displacement + slight color shift** to brand |
| Intensity | **Medium** — `MAX_PUSH = 14px`, `INFLUENCE_RADIUS = 220px` |

## Why Canvas (not CSS)

Three CSS-based attempts failed (mix-blend-mode, alpha bumps, mask-image with CSS vars). Root cause investigation is moot because the **new** spec requires per-dot independent position control — this is structurally impossible with CSS background gradients (every dot in a `radial-gradient` repeating background shares one transform).

Canvas 2D gives:
- Per-dot position control (required for repulsion)
- Per-dot color lerp (required for color shift)
- No browser CSS-var-in-mask repaint bug
- Acceptable perf at 22px grid density (~4300 dots at 1920×1080)

WebGL is overkill; SVG can't handle ~4300 element mutations per frame at 60fps.

## Architecture

```
BackgroundDotGrid.tsx (client component, mounted once in app/layout.tsx)
└── <canvas aria-hidden fixed inset-0 -z-10 pointer-events-none />
    └── useEffect:
        ├── Resolve theme colors from CSS variables (parse HSL → RGB)
        ├── Build static dot grid: array of { x, y } at GAP=22px
        ├── Listen mousemove (passive), mouseleave, resize, theme change
        └── rAF loop renders displaced + color-lerped dots
```

## Render Algorithm (per frame)

```
1. Lerp currentMouse toward targetMouse by LERP_FACTOR
2. Clear canvas
3. For each dot in grid:
     dx = dot.x - currentMouse.x
     dy = dot.y - currentMouse.y
     dist = sqrt(dx² + dy²)
     if dist >= INFLUENCE_RADIUS:
       drawDot(dot.x, dot.y, staticColor)
       continue
     t = 1 - dist / INFLUENCE_RADIUS        // 0 at edge, 1 at center
     falloff = t * t                        // quadratic decay
     push = falloff * MAX_PUSH
     unitX = dx / max(dist, 0.001)
     unitY = dy / max(dist, 0.001)
     drawX = dot.x + unitX * push
     drawY = dot.y + unitY * push
     color = lerpRGBA(staticColor, brandColor, falloff)
     drawDot(drawX, drawY, color)
4. Continue rAF if cursor not settled OR any dot still displaced
```

## Constants

| Name | Value | Notes |
|---|---|---|
| `GAP` | `22` | px between dot centers (matches current grid) |
| `DOT_RADIUS` | `1.0` | px, scaled by DPR for crispness |
| `INFLUENCE_RADIUS` | `220` | px, "medium intensity" |
| `MAX_PUSH` | `14` | px, mid of 12-16 range |
| `LERP_FACTOR` | `0.18` | mouse spring smoothing |
| `SETTLE_THRESHOLD` | `0.3` | px, stop rAF when below |

## Theme Handling

Read CSS variables once at mount and on theme change:
- `--foreground` → `staticColor` at `alpha = 0.14`
- `--brand-from` → `brandColor` at `alpha = 1.0` (full saturation when fully repelled)

Parse HSL strings (e.g. `"240 10% 3.9%"`) into RGB so canvas `fillStyle` works directly.

Re-resolve colors when:
1. `MutationObserver` on `<html>` `class` attribute (catches manual `.dark` toggle)
2. `matchMedia('(prefers-color-scheme: dark)').change` (catches OS theme change)

In dark mode, brand color is overridden to `hsl(220 100% 78%)` to match the existing dark-mode visual contrast (already in current `globals.css`).

## Sizing & DPR

- `canvas.width = innerWidth * DPR`, `canvas.height = innerHeight * DPR`
- `canvas.style.{width,height} = innerWidth/innerHeight px`
- `ctx.scale(DPR, DPR)` after each resize
- `ResizeObserver` on `document.documentElement` rebuilds the grid + resizes canvas
- Grid extends slightly beyond viewport (`-GAP` margin) so dots don't pop in at edges

## rAF Lifecycle (perf)

- **Initial mount:** draw static grid once (cursor not yet in viewport).
- **Idle:** rAF stopped. Canvas holds the last frame (static grid since cursor offscreen).
- **Mousemove:** kick rAF.
- **Stop condition:** `|target - current| < 0.3` AND no dot has displacement > 0.3px (i.e., cursor moved offscreen and dots fully relaxed).

This avoids burning CPU when the user isn't moving the mouse.

## Accessibility

- `aria-hidden="true"` on canvas
- `pointer-events: none` (clicks pass through)
- If `prefers-reduced-motion: reduce` OR `hover: none` (touch device):
  - Skip mousemove listener entirely
  - Draw static grid once on mount and on each resize
  - No rAF loop runs

## Files Changed

| File | Change |
|---|---|
| `landing/components/BackgroundDotGrid.tsx` | Full rewrite (~150 lines) |
| `landing/app/globals.css` | Remove `.bg-dot-grid`, `.bg-dot-cursor`, `.bg-dot-bloom`, `.bg-dot-grid-glow` (~70 lines) |

`landing/app/layout.tsx` already mounts `<BackgroundDotGrid />` — no change needed there.

## Testing Plan

Local production build only (no dev server — OOMs on user's machine):

```
cd landing
npm run build
npx serve out -p 3001
```

**Manual verification at `http://localhost:3001/en/`:**
1. Move cursor across viewport → dots within ~220px push away from cursor and tint brand-blue, dots outside that radius stay static gray
2. Stop moving → dots spring back to grid position smoothly
3. Move cursor offscreen → all dots return to base state, rAF stops (verify in Chrome Performance panel: no rAF callbacks during idle)
4. Toggle OS theme → brand color updates without page reload
5. DevTools → emulate `prefers-reduced-motion: reduce` → effect disabled, static grid still visible
6. Resize window → grid rebuilds, no dots clipped at edges
7. DPR check on a hi-DPI screen (or DevTools device toolbar at 2×) → dots stay crisp

**Visual confirmation gate:** user must visually confirm the effect works in browser before any commit.

## Out of Scope

- Mobile / touch device animation (skipped per `hover: none` rule)
- Velocity-based effects (cursor speed → push strength)
- Multi-pointer (multitouch repulsion)
- Per-section variation (different intensity in hero vs. install section)
- Replacing the existing site's other animations or sections
