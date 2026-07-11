# LogoWall Marquee Ticker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 4-column `<ul>` grid in the hero with a single-row horizontal marquee ticker that loops the 16-brand set forever, edge-faded both sides, with no hover interaction and full a11y support.

**Architecture:** CSS-only `@keyframes` animation (no JS, no new deps) on a flex track holding two identical `<ul>` segments. Second segment is `aria-hidden="true"` so screen readers announce 16 brands, not 32. Edge fade is a `mask-image` linear-gradient. Reduced-motion halts the animation cleanly.

**Tech Stack:** React 18, Next.js 15, Tailwind CSS, plain CSS `@keyframes`, vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-07-11-logowall-marquee-design.md`

---

## File Structure

**Modified files:**
- `landing/components/LogoWall.tsx` — rewrite (~45 lines). Replace grid `<ul>` with two `<ul>` segments inside a `.marquee-track` div, wrapped by a `.mask-fade` region. Drop all hover/transition classes on `LogoCell` (per "no interaction" requirement).
- `landing/app/globals.css` — append ~40 lines to `@layer components` for `.mask-fade`, `.marquee-track`, `.marquee-segment`, `.logo-cell`, `@keyframes marquee-scroll`, and reduced-motion override.
- `landing/components/LogoWall.test.tsx` — replace 4 assertions with 5 new ones (see Task 3).

**No new files. No deleted files. No new dependencies.**

---

## Task 1: Rewrite `LogoWall.tsx`

**Files:**
- Modify: `landing/components/LogoWall.tsx`

### Step 1: Read current file (already done in planning — verify it's still the version above)

Run: `cat d:/SmoothScroll/landing/components/LogoWall.tsx` (or open in editor).

Expected: 44 lines, contains `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` and `group hover:bg-muted/60` on `LogoCell`.

### Step 2: Replace entire file content

Replace the full content of `landing/components/LogoWall.tsx` with:

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

**What changed vs current:**
- Outer wrapper: removed `w-full` (re-added), added `overflow-hidden` and `mask-fade` (CSS class).
- Removed `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 max-w-3xl mx-auto w-full min-w-0` from `<ul>`.
- New structure: `.marquee-track` div wraps two `<ul class="marquee-segment">` siblings. Second `<ul>` has `aria-hidden="true"`.
- `LogoCell` lost `group`, `hover:bg-muted/60`, `focus-within:bg-muted/60`, `transition-colors`, `rounded-md` — no hover interaction per spec.
- `LogoCell` img lost `opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity` — no hover interaction per spec.
- `LogoCell` span lost `group-hover:text-foreground group-focus-within:text-foreground` — no hover interaction per spec.
- Added `logo-cell` CSS hook class for the fixed min-width (168px) defined in globals.css.

### Step 3: Verify TypeScript compiles

Run: `cd d:/SmoothScroll/landing && pnpm exec tsc --noEmit`

Expected: no errors.

If errors about `LogoCell` props or `BRANDS` import: check `landing/lib/brands.ts` exports `BRANDS: Brand[]` and `Brand` type — both already confirmed during planning.

### Step 4: Commit

```bash
cd d:/SmoothScroll
git add landing/components/LogoWall.tsx
git commit -m "landing: rewrite LogoWall as horizontal marquee ticker

Replace the static 4-column brand grid with a single-row CSS-only
marquee that loops the 16-brand set forever. Edge-faded on both
sides, paused under prefers-reduced-motion, no hover interaction.

Two <ul> segments (second aria-hidden) so screen readers still
announce exactly 16 brands."
```

---

## Task 2: Append CSS to `globals.css`

**Files:**
- Modify: `landing/app/globals.css` (append to `@layer components` block, around line 97)

### Step 1: Locate the end of `@layer components`

Run: search the file for `}` at the start of a line (column 1) that closes `@layer components`. In the current file, `@layer components` opens at line 97. The block contains `.bg-dot-grid::before` etc. Find its closing `}` and insert the new rules just before it.

Quick way to inspect: `grep -n "^}" d:/SmoothScroll/landing/app/globals.css`

Expected: a line near the bottom that closes `@layer components`. Insert just before it.

### Step 2: Insert CSS rules

Add the following block immediately before the closing `}` of `@layer components`:

```css

  /* ----- LogoWall marquee ticker ----- */

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

  /* Fixed min-width so 16 cells = exactly half the doubled track */
  .logo-cell {
    flex: 0 0 auto;
    min-width: 168px;
  }

  /* -50% loops seamlessly because two segments are equal width */
  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* Belt-and-suspenders reduced-motion stop */
  @media (prefers-reduced-motion: reduce) {
    .marquee-track {
      animation: none;
    }
  }
```

**Important:** Keep the existing `.bg-dot-grid` rules and other `@layer components` content untouched. We're appending, not replacing.

### Step 3: Verify CSS doesn't break the build

Run: `cd d:/SmoothScroll/landing && pnpm build 2>&1 | tail -30`

Expected: build succeeds. (Tailwind/PostCSS will just include the new selectors; if they conflict with existing classes, build will fail with a useful error.)

### Step 4: Sanity-check the final CSS

Run: search the file for the new classes:
```bash
grep -n "marquee-track\|marquee-segment\|mask-fade\|logo-cell\|marquee-scroll" d:/SmoothScroll/landing/app/globals.css
```

Expected: each name appears exactly once, all inside `@layer components`.

### Step 5: Commit

```bash
cd d:/SmoothScroll
git add landing/app/globals.css
git commit -m "landing: add LogoWall marquee CSS (track, segments, edge fade, reduced-motion)"
```

---

## Task 3: Update `LogoWall.test.tsx`

**Files:**
- Modify: `landing/components/LogoWall.test.tsx`

### Step 1: Replace entire test file

Replace the full content of `landing/components/LogoWall.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogoWall } from './LogoWall'
import { BRANDS } from '@/lib/brands'

describe('LogoWall', () => {
  it('renders all 16 unique brands across both segments', () => {
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

**What changed vs current:**
- Removed: "renders all 16 brand cells" (cell count assertion — now 32 due to duplication).
- Removed: "has no animation classes on the wrapper" (no longer true; we now have a marquee).
- Removed: "uses a static grid layout (no marquee classes)" (no longer true).
- Added: "renders all 16 unique brands across both segments" — uses a Set so duplicated cells don't double-count.
- Added: "exposes a marquee track element" — confirms `.marquee-track` div exists.
- Added: "applies edge-fade mask to the region" — confirms `.mask-fade` on the wrapper.
- Added: "marks exactly one segment aria-hidden to avoid double-read" — confirms 2 ul, 1 hidden.
- Kept: "every cell has an accessible name from a brand" — still valid.

### Step 2: Run tests to verify they pass

Run: `cd d:/SmoothScroll/landing && pnpm test LogoWall`

Expected: 5 tests pass.

If any fail:
- "renders all 16 unique brands" fails → check the two `<ul>` segments are both rendering all 16 brands each, with unique keys.
- "exposes a marquee track element" fails → check the `<div className="marquee-track">` is present.
- "applies edge-fade mask to the region" fails → check the region wrapper has `mask-fade` class.
- "marks exactly one segment aria-hidden" fails → check second `<ul>` has `aria-hidden="true"`.
- "every cell has an accessible name" fails → check `BRANDS` import and `Brand.name` types.

### Step 3: Commit

```bash
cd d:/SmoothScroll
git add landing/components/LogoWall.test.tsx
git commit -m "landing: update LogoWall tests for marquee structure (a11y, track, mask)"
```

---

## Task 4: Full Verification

### Step 1: Run full test suite

Run: `cd d:/SmoothScroll/landing && pnpm test`

Expected: all tests pass (including the 5 new LogoWall assertions and any pre-existing component tests).

### Step 2: Run full build

Run: `cd d:/SmoothScroll/landing && pnpm build`

Expected: build succeeds. Output mentions no errors.

### Step 3: Manual visual check

Run: `cd d:/SmoothScroll/landing && pnpm dev`

Open `http://localhost:3000` in browser.

Verify:
- [ ] Single row of brand cells visible in the hero.
- [ ] Cells scroll continuously leftward at ~40s per loop.
- [ ] Both edges fade smoothly (left side fades to transparent, right side too).
- [ ] No hover effect on cells (no bg change, no scale).
- [ ] In DevTools, open Rendering panel → set "Emulate CSS prefers-reduced-motion: reduce" → animation halts, content stays visible at `translateX(0)` showing all 16 brands.
- [ ] Toggle dark mode → icons that should invert do (macOS, Cursor, Notion).
- [ ] Open DevTools Accessibility panel → confirm region has accessible name, screen-reader announces 16 brands.

### Step 4: Lighthouse spot-check (optional)

Run: open DevTools → Lighthouse → Performance + Accessibility.

Expected: scores unchanged or improved (CSS-only animation is faster than a JS-driven one).

### Step 5: Final commit (if any uncommitted changes remain)

```bash
cd d:/SmoothScroll
git status
```

If clean, no commit needed. If anything changed during verification (e.g., typo fix in CSS):

```bash
git add -A
git commit -m "landing: final tweaks to LogoWall marquee"
```

---

## Rollback Plan

Each task is its own commit. To roll back:

- Full revert: `git revert HEAD~3..HEAD` (or whatever the commit range is — 3 commits for the 3 file changes, plus any verification tweaks).
- Partial revert:
  - Component only: `git revert <task-1-commit>`
  - CSS only: `git revert <task-2-commit>`
  - Tests only: `git revert <task-3-commit>`

No data migrations, no schema changes, no dependency changes — pure visual swap.

---

## Success Criteria

- [ ] All 5 LogoWall tests pass
- [ ] `pnpm test` passes (no other tests broken)
- [ ] `pnpm build` succeeds
- [ ] Visual: ticker scrolls at ~40s/loop, edge-faded both sides, no hover effects
- [ ] A11y: screen reader announces exactly 16 brands
- [ ] Reduced-motion: animation halts cleanly, content still visible
- [ ] Dark mode: invertOnDark icons invert correctly
- [ ] 3 commits (or 4 if verification tweaks needed), each scoped to a single concern