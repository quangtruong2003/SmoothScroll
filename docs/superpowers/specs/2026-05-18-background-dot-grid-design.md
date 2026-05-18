# Background Dot Grid + Parallax Light — Design Spec

**Date:** 2026-05-18
**Status:** Approved by user, ready for implementation plan
**Scope:** Landing page only (`landing/` directory)

## Goal

Replace the flat background of the landing page with a subtle, technical-feeling visual: a static dot grid overlaid with a small radial light that follows the cursor. Adds visual depth without competing with foreground content.

## Non-goals

- Replacing existing per-section backgrounds (TrayPreviewSection's `bg-muted/30` etc. stay).
- Animating the dot grid itself (no shimmer, no random fade).
- Adding background to the desktop app (`src/`) — landing page only.
- 3D / WebGL / canvas effects — pure CSS + minimal JS.

## User decisions captured

| Question | Answer |
|---|---|
| Scope | Toàn bộ trang (full landing) |
| Effect type | Dot grid + parallax light |
| Intensity | Tinh tế (subtle) |

## Architecture

A single client component `BackgroundDotGrid.tsx` mounts in the root layout. It renders a `position: fixed` element covering the viewport at `z-index: -1`, behind every other section. It does not re-mount when the user navigates between locales because it sits in the root `app/layout.tsx` which is shared across all routes.

```
<body>
  <BackgroundDotGrid />   ← fixed, inset-0, z-index: -1, pointer-events: none
  <Navigation />          ← existing sections render normally above
  <main>{children}</main>
  <Footer />
  <Toaster />
</body>
```

## Two visual layers

### Layer 1 — Static dot grid (always visible, full viewport)

- 1.5 px circular dots on a 24 px grid.
- Color: `hsl(var(--foreground) / 0.03)` — uses the existing CSS variable so it auto-inverts in dark mode.
- Implemented as a CSS `background-image` with an inline SVG data URL — no extra HTTP request, no JS to draw.

```css
.bg-dot-grid::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='0.75' fill='currentColor' /></svg>");
  background-size: 24px 24px;
  color: hsl(var(--foreground));
  opacity: 0.03;
}
```

### Layer 2 — Parallax light spotlight (cursor-following)

- A radial gradient overlay that becomes visible only inside a ~150 px circle centered on the cursor.
- Uses the brand gradient (`--brand-from` → `--brand-to`) at ~8 % center opacity, fading to 0 at the edge.
- Position controlled by two CSS custom properties `--mx` and `--my` updated from a single `mousemove` listener.

```css
.bg-dot-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 150px at var(--mx, 50%) var(--my, 50%),
    hsl(var(--brand-from) / 0.08),
    hsl(var(--brand-to) / 0.04) 60%,
    transparent 100%
  );
  transition: opacity 200ms ease-out;
}
```

## Data flow

```
mousemove (window)
  └─> requestAnimationFrame coalesce (max 60 fps)
        └─> root.style.setProperty('--mx', x + 'px')
            root.style.setProperty('--my', y + 'px')
```

- The handler writes only to CSS custom properties on the BackgroundDotGrid root element. No React re-render per mouse movement.
- `requestAnimationFrame` is used to drop redundant events that arrive faster than the next paint.
- The gradient position update is composited by the GPU — no reflow, no layout, no repaint of the dot grid layer.

## Component shape

```tsx
'use client'

import { useEffect, useRef } from 'react'

export function BackgroundDotGrid() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Respect reduced motion: keep the static dot grid, skip the cursor-following light.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Touch-only devices have no meaningful cursor; skip the light entirely.
    const noHover = window.matchMedia('(hover: none)').matches
    if (reduced || noHover) {
      root.style.setProperty('--mx', '50%')
      root.style.setProperty('--my', '50%')
      return
    }

    let pendingX = 0
    let pendingY = 0
    let queued = false

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX
      pendingY = e.clientY
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        root.style.setProperty('--mx', pendingX + 'px')
        root.style.setProperty('--my', pendingY + 'px')
        queued = false
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="bg-dot-grid pointer-events-none fixed inset-0 -z-10"
    />
  )
}
```

The effect is purely decorative, so the wrapper element gets `aria-hidden="true"` and `pointer-events: none`.

## Layout integration

`app/layout.tsx` mounts the component once:

```tsx
<body>
  <BackgroundDotGrid />
  {children}
  <Toaster ... />
</body>
```

The body itself does not need a transparent background — the existing `bg-background` keeps a solid base color, and the `BackgroundDotGrid` sits at `z-index: -1` so it shows through any section that does not declare its own background.

## Edge cases

| Case | Handling |
|---|---|
| Touch-only device (`hover: none`) | Skip mousemove listener; spotlight stays at center with same opacity. Visual cost is minimal. |
| `prefers-reduced-motion: reduce` | Same as touch-only — no cursor tracking. |
| Section with its own background (e.g. `TrayPreviewSection` uses `bg-muted/30`) | That section's background paints over the global dot grid because it is in the normal stacking context. Acceptable — the dot grid just doesn't show there. |
| Dark mode | `--foreground` flips automatically; brand colors stay the same hue. Both layers re-tone correctly with no extra work. |
| Window resize | No state to recompute; the radial gradient uses pixel coordinates relative to the viewport, which is what `clientX/clientY` already give. |
| Server-side render | Component is a `'use client'` boundary. The static dot grid renders identically on server and client because it is pure CSS — no hydration mismatch. The cursor light only activates after `useEffect` runs on the client, so initial paint is fine. |

## Performance

- Single fixed element. One mounted instance for the whole app lifetime.
- Mousemove handler is `passive: true` and rAF-throttled. At 60 Hz, max 60 property writes per second. Each write is a CSS variable update — composited, no JS reflow.
- The animated property is `background-position` of a radial gradient. Modern browsers paint radial gradients on the compositor when the only changing property is gradient position via custom property.
- Dot grid layer is static; it paints once.
- No `requestAnimationFrame` loop runs while the cursor is idle.
- Bundle impact: under 1 KB of JS, zero new dependencies.

## Files affected

| Action | File |
|---|---|
| Create | `landing/components/BackgroundDotGrid.tsx` |
| Modify | `landing/app/layout.tsx` (import + mount the component) |
| Modify | `landing/app/globals.css` (add `.bg-dot-grid` rules) |

No other files touched. No shadcn primitives changed. No section components touched.

## Testing

- **Unit tests**: not warranted — the component is pure visual side-effect.
- **Type / build**: existing `next build` and `tsc --noEmit` cover correctness.
- **Visual regression**: optional Playwright screenshot at `1280x800` and `375x667`, both light and dark mode, of the Hero section. Dot grid should appear at low opacity in both, spotlight only in light/dark when the test moves the cursor.
- **Reduced-motion check**: Playwright with `reduceMotion: 'reduce'` should not throw and should still render the static dot grid.

## Risks / trade-offs

- **Browser compatibility**: CSS `mask-image` is well-supported in Chromium and Firefox; we are using a radial gradient as `background`, not as `mask`, so no mask compatibility risk.
- **Mobile distraction**: The cursor-following light is disabled on `hover: none` devices, so phones see only the static dot grid. The dot grid alone is calm enough that it should not interfere with reading on small screens.
- **Section transparency**: If a future section is added with a transparent background expecting the body color, the dot grid will show through. That is the intended behavior for this design.

## Open questions

None. All visual / scope / intensity decisions made by the user during brainstorming.

## Implementation order

1. Add `.bg-dot-grid` styles to `globals.css`.
2. Create `BackgroundDotGrid.tsx` with the listener.
3. Mount in `app/layout.tsx` after `<body>` opens.
4. Visual sanity check in dev: light mode, dark mode, reduced motion, touch (DevTools emulator).
5. Production build verification and deploy.
