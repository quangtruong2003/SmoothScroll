# Design: LogoWall Marquee Ticker

## Context

The hero section's "compatible apps and operating systems" grid currently renders as a static 4-column `<ul>` of 16 brand cells. User wants to swap it for a single-row, continuous horizontal ticker — like a stock-tape — that loops the brand set forever, edge-faded on both sides, with no hover interaction.

This is a small visual-only change to one component (`LogoWall`) plus a CSS keyframe block. No new dependencies, no behavioral change.

User-confirmed parameters:

- Speed: ~40s per full loop (medium)
- Hover: none (cells are not interactive)
- Edge fade: both sides, ~80px
- Trigger: auto-play on page load (no scroll-into-view gating)
- A11y: two `<ul>` segments, second wrapped in `aria-hidden="true"` to avoid duplicate screen-reader announcements

## Goal

Replace the static LogoWall grid with a horizontal marquee ticker that:

1. Loops seamlessly at ~40s per cycle
2. Fades on both edges (~80px) so cells visually enter/exit softly
3. Pauses cleanly under `prefers-reduced-motion: reduce`
4. Renders all 16 unique brands exactly once to screen readers
5. Adds zero JS, zero new dependencies, zero hydration cost

## Non-Goals

- No new dependencies (no framer-motion, no marquee library)
- No changes to `lib/brands.ts`, `Hero.tsx`, or any other section
- No hover/cursor effects on cells (user explicitly opted out)
- No scroll-into-view trigger — always plays
- No RTL flip — English-only landing for now

## Component Changes

### File: `landing/components/LogoWall.tsx` (rewritten)

```tsx
import { BRANDS, type Brand } from '@/lib/brands'

function LogoCell({ brand }: { brand: Brand }) {
  return (
    <li
      role="listitem"
      aria-label={brand.name}
      className="logo-cell flex items-center gap-2 px-3 py-2 min-w-0"
    >
      <img
        src={brand.src}
        alt=""
        width={24}
        height={24}
        decoding="async"
        loading="lazy"
        className={`h-6 w-6 shrink-0 ${brand.invertOnDark ? 'dark:invert' : ''}`}
      />
      <span className="text-sm font-medium text-muted-foreground truncate">
        {brand.name}
      </span>
    </li>
  )
}

export function LogoWall() {
  return (
    <div
      role="region"
      aria-label="Compatible apps and operating systems"
      className="logo-wall w-full overflow-hidden mask-fade"
    >
      <div className="marquee-track">
        <ul role="list" className="marquee-segment">
          {BRANDS.map((b) => (
            <LogoCell key={b.slug} brand={b} />
          ))}
        </ul>
        <ul role="list" aria-hidden="true" className="marquee-segment">
          {BRANDS.map((b) => (
            <LogoCell key={`${b.slug}-dup`} brand={b} />
          ))}
        </ul>
      </div>
    </div>
  )
}
```

**Why two `<ul>` segments instead of one doubled list:** screen readers and crawlers must see 16 brands, not 32. The `aria-hidden="true"` second segment is visually identical to the first (so the loop seam is invisible) but excluded from assistive tech.

**Why CSS `@keyframes` over framer-motion:** zero JS, zero hydration cost, automatically paused by the global `prefers-reduced-motion` block already in `globals.css`. Lighthouse perf stays clean.

### File: `landing/app/globals.css` (appended to `@layer components`)

```css
/* Edge fade — both sides, ~80px */
.mask-fade {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    black 80px,
    black calc(100% - 80px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0,
    black 80px,
    black calc(100% - 80px),
    transparent 100%
  );
}

/* Flex track holds two identical ul segments side-by-side */
.marquee-track {
  display: flex;
  width: max-content;
  will-change: transform;
  animation: marquee-scroll 40s linear infinite;
}

.marquee-segment {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

/* Each cell fixed-min-width so 16 cells = exactly half the doubled track */
.logo-cell {
  flex: 0 0 auto;
  min-width: 168px;
}

/* -50% loops seamlessly because two segments are equal width */
@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* Belt-and-suspenders reduced-motion stop (globals.css has a global rule,
   but we add an explicit one so the marquee stops even if global block is
   ever removed) */
@media (prefers-reduced-motion: reduce) {
  .marquee-track {
    animation: none;
  }
}
```

**Why `-50%` not pixel-based:** viewport width changes don't break a percentage-based loop — the track is always 2× one segment regardless of viewport, so the math stays consistent.

**Why `min-width: 168px` per cell:** at narrow viewports, 168px keeps the icon (24) + gap (8) + text (~120) + padding (24×2) readable while scrolling. Cells truncate text but never collapse to nothing.

### File: `landing/components/LogoWall.test.tsx` (updated)

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogoWall } from './LogoWall'
import { BRANDS } from '@/lib/brands'

describe('LogoWall', () => {
  it('renders all 16 unique brands', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    const uniqueNames = new Set(cells.map((c) => c.getAttribute('aria-label')))
    expect(uniqueNames.size).toBe(BRANDS.length)
    expect(uniqueNames.size).toBe(16)
  })

  it('exposes a marquee track element', () => {
    const { container } = render(<LogoWall />)
    const track = container.querySelector('.marquee-track')
    expect(track).not.toBeNull()
  })

  it('applies edge-fade mask to the region', () => {
    render(<LogoWall />)
    const region = screen.getByRole('region')
    expect(region.className).toContain('mask-fade')
  })

  it('marks exactly one segment aria-hidden to avoid double-read', () => {
    const { container } = render(<LogoWall />)
    const lists = container.querySelectorAll('ul[role="list"]')
    expect(lists.length).toBe(2)
    const hidden = Array.from(lists).filter(
      (l) => l.getAttribute('aria-hidden') === 'true'
    )
    expect(hidden.length).toBe(1)
  })

  it('every cell has an accessible name from a brand', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    const brandNames = BRANDS.map((b) => b.name)
    for (const cell of cells) {
      expect(brandNames).toContain(cell.getAttribute('aria-label'))
    }
  })
})
```

**Removed assertions (no longer apply):**

- "uses a static grid layout" — replaced with marquee track test
- "no animation classes on wrapper" — replaced with `.marquee-track` assertion

## Files Touched

| File | Action |
|------|--------|
| `landing/components/LogoWall.tsx` | Rewrite (~40 lines) |
| `landing/app/globals.css` | Append ~40 lines to `@layer components` |
| `landing/components/LogoWall.test.tsx` | Replace assertions (~40 lines) |

**No file deletions. No new files. No new dependencies.**

## Verification Plan

1. `pnpm --filter landing test LogoWall` — all 5 tests pass
2. `pnpm --filter landing build` — no TS / build errors
3. `pnpm --filter landing dev` then open `localhost:3000`:
   - Ticker scrolls continuously at ~40s/loop, no jank
   - Both edges fade smoothly (~80px each side)
   - Cells are NOT interactive on hover (no bg change, no scale)
   - DevTools → toggle "Emulate prefers-reduced-motion: reduce" → animation halts, content stays visible
   - Lighthouse perf score unchanged or improved
4. Lighthouse a11y: confirm region has accessible name and screen reader announces 16 brands (not 32)
5. Visual check in both light and dark mode (cell icons invert correctly via `dark:invert` class preserved)

## Risks

| Risk | Mitigation |
|------|------------|
| Animation jank on low-end devices | `will-change: transform` + GPU compositing; CSS-only, no JS event loop pressure |
| Text unreadable while moving | `text-muted-foreground` matches existing style; scroll speed (40s) is slow enough to read briefly |
| Reduced-motion users see broken layout | `.marquee-track { animation: none }` halts at `translateX(0)` — first segment shows all 16 brands in view |
| Loop seam visible | Two segments are pixel-identical (same `BRANDS` array, same `LogoCell` component); `-50%` lands exactly on the seam |
| Existing tests assert grid behavior | Test file is being rewritten in this same change; no stale references remain |

## Rollback

Revert the three files via git. No data migrations, no API changes — purely visual swap.

## Implementation Order

1. Update `landing/components/LogoWall.tsx` (rewrite)
2. Append CSS to `landing/app/globals.css`
3. Update `landing/components/LogoWall.test.tsx`
4. Run `pnpm --filter landing test LogoWall` → expect green
5. Run `pnpm --filter landing build` → expect green
6. Spot-check in dev server + devtools reduced-motion toggle
7. Commit