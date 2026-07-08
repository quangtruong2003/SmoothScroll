# SmoothScroll Landing Sprint 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace perpetual marquee with a static LogoWall (per design-taste-frontend Section 9.F marquee ban). Recalibrate hero typography. Audit button contrast. Verify empty/loading states and mobile collapse. Final pre-flight checklist pass.

**Architecture:** LogoWall replaces BrandMarquee entirely (rename and rewrite). Hero typography tuned conservatively (one step smaller on `xl` breakpoint). Button contrast is a verify-and-fix pass against the existing tokens. No new design system, no new dependencies.

**Tech Stack:** Tailwind CSS, shadcn/ui primitives, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-07-08-smoothscroll-landing-audit-redesign-design.md`
**Sprint scope:** Section 3, Sprint 4 (T4.1 - T4.6)
**Prerequisite:** Sprints 1, 2, and 3 complete

---

## File Structure

**New files:**
- `landing/components/LogoWall.tsx` - static grid replacing BrandMarquee
- `landing/components/LogoWall.test.tsx` - render and animation-class assertions

**Modified files:**
- `landing/components/sections/Hero.tsx` - swap BrandMarquee import, hero type scale tweak
- `landing/components/sections/ScrollDemo.tsx` - verify loading fallback
- `landing/app/globals.css` - verify final theme parity

**Deleted files (after migration):**
- `landing/components/BrandMarquee.tsx`

**Tests:**
- `landing/e2e/visual-regression.spec.ts` - optional Playwright screenshots

---

## Task 4.1: Create LogoWall component

**Files:**
- Create: `landing/components/LogoWall.tsx`

Static 4-col × 4-row grid on desktop, 2-col on mobile. No animation. Each cell: icon + name. Opacity 0.6 → 1.0 on hover.

- [ ] **Step 1: Write the failing test**

Create `landing/components/LogoWall.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { LogoWall } from './LogoWall'

describe('LogoWall', () => {
  it('renders all 16 brand cells', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    expect(cells).toHaveLength(16)
  })

  it('has no animation classes', () => {
    render(<LogoWall />)
    const wrapper = screen.getByRole('region')
    expect(wrapper.className).not.toContain('animate-')
    expect(wrapper.className).not.toContain('marquee')
  })

  it('every cell has accessible name from brand', () => {
    render(<LogoWall />)
    expect(screen.getByLabelText('Windows 11')).toBeInTheDocument()
    expect(screen.getByLabelText('Chrome')).toBeInTheDocument()
    expect(screen.getByLabelText('Figma')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test LogoWall`
Expected: FAIL (component doesn't exist yet).

- [ ] **Step 3: Create LogoWall component**

Create `landing/components/LogoWall.tsx`:

```tsx
import { BRANDS, type Brand } from '@/lib/brands'

function LogoCell({ brand }: { brand: Brand }) {
  return (
    <li
      role="listitem"
      aria-label={brand.name}
      className="flex items-center gap-2 px-3 py-2 rounded-md opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity"
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
      className="w-full"
    >
      <ul
        role="list"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 max-w-3xl mx-auto"
      >
        {BRANDS.map((b) => (
          <LogoCell key={b.slug} brand={b} />
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test LogoWall`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/LogoWall.tsx landing/components/LogoWall.test.tsx
git commit -m "feat(hero): add LogoWall static grid component"
```

---

## Task 4.2: Replace BrandMarquee with LogoWall in Hero

**Files:**
- Modify: `landing/components/sections/Hero.tsx`
- Delete: `landing/components/BrandMarquee.tsx`

- [ ] **Step 1: Update Hero.tsx import and usage**

In `landing/components/sections/Hero.tsx`, replace the import:

```tsx
// Remove:
import { BrandMarquee } from '@/components/BrandMarquee'

// Add:
import { LogoWall } from '@/components/LogoWall'
```

Replace usage in JSX:

```tsx
// Remove:
<div className="w-full max-w-xl">
  <BrandMarquee />
</div>

// Add:
<div className="w-full max-w-3xl">
  <LogoWall />
</div>
```

- [ ] **Step 2: Verify build**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success. No import error for `BrandMarquee`.

- [ ] **Step 3: Delete BrandMarquee file**

Run: `cd D:/SmoothScroll && rm landing/components/BrandMarquee.tsx`

- [ ] **Step 4: Verify build still passes**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success.

- [ ] **Step 5: Manual verify**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Hero section now shows a 4-col grid of brand logos (no animation, no horizontal scroll).
Hover any logo → opacity goes to 1.0.
Resize to mobile (390px) → 2-col grid.

- [ ] **Step 6: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/Hero.tsx
git commit -m "refactor(hero): replace BrandMarquee with LogoWall"
```

Then in a second commit (or same), delete the unused file:

```bash
cd D:/SmoothScroll
git add -u landing/components/
git commit -m "chore: remove unused BrandMarquee component"
```

(Or combine into one commit with `git add -A` - note that `rm` outside git doesn't stage; use `git rm`.)

- [ ] **Step 7: Re-run full test suite**

Run: `cd D:/SmoothScroll/landing && pnpm test`
Expected: all tests pass. If any test imports `BrandMarquee`, update or remove that import.

---

## Task 4.3: Hero typography recalibration

**Files:**
- Modify: `landing/components/sections/Hero.tsx`

Tone down `xl:text-8xl` to `xl:text-7xl` for less aggressive scaling on large screens.

- [ ] **Step 1: Read current H1 class string**

Read `landing/components/sections/Hero.tsx`. The H1 currently has:

```tsx
className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150"
```

- [ ] **Step 2: Update xl breakpoint**

Change to:

```tsx
className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-7xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150"
```

(Note: `xl:text-8xl` → `xl:text-7xl`. The cap is now `lg:text-7xl`. This is one step smaller at the largest viewport, preventing text from feeling oversized.)

- [ ] **Step 3: Verify visually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/` at 1440px viewport → H1 noticeably less aggressive than before.
At 320px → H1 still readable, no overflow.

- [ ] **Step 4: Verify 390px viewport no overflow**

DevTools mobile emulation 390×844 → `document.documentElement.scrollWidth === clientWidth`.

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/Hero.tsx
git commit -m "fix(hero): cap H1 at text-7xl for less aggressive scaling"
```

---

## Task 4.4: Button contrast audit

**Files:**
- Modify: `landing/app/globals.css` (verify tokens)
- Modify: `landing/components/ui/button.tsx` (verify variants)

- [ ] **Step 1: Read button.tsx to understand variants**

Read `landing/components/ui/button.tsx`. Identify the `default`, `secondary`, `ghost`, `outline`, `brand` variants (if any).

- [ ] **Step 2: Compute contrast for each variant**

For each variant in light mode AND dark mode:
- Find foreground color
- Find background color (or transparent → parent bg)
- Compute contrast ratio using formula `(L1 + 0.05) / (L2 + 0.05)` where L is relative luminance

Document in a temporary file `landing/BUTTON_CONTRAST.md`:

```markdown
| Variant | Mode | Foreground | Background | Ratio | AA |
|---------|------|------------|------------|-------|-----|
| default | light | hsl(0 0% 98%) | hsl(240 5.9% 10%) | 18.0:1 | PASS |
| ...     | ...  | ...        | ...        | ...   | ... |
```

- [ ] **Step 3: Fix any failing variants**

For any variant with ratio < 4.5:1 (body text) or < 3:1 (large text 18pt+), adjust the token in `globals.css` or the variant class in `button.tsx`. Common fix: darken `--primary` foreground or lighten `--primary` background by 5-10%.

For the `brand` variant used in Hero CTA (Download for Windows), ensure contrast against background ≥4.5:1 in both themes.

- [ ] **Step 4: Verify with axe-core in e2e**

The existing `e2e/a11y-audit.spec.ts` from Sprint 1 already scans for color-contrast violations. Re-run it:

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e a11y-audit`
Expected: PASS. If failures appear, iterate Step 3.

- [ ] **Step 5: Clean up temp file**

Run: `cd D:/SmoothScroll && rm landing/BUTTON_CONTRAST.md`

- [ ] **Step 6: Commit (if any changes)**

```bash
cd D:/SmoothScroll
git add landing/app/globals.css landing/components/ui/button.tsx
git commit -m "fix(a11y): button contrast audit pass"
```

(If no changes were needed, skip this commit.)

---

## Task 4.5: Empty/loading states verification

**Files:**
- Modify: `landing/components/sections/ScrollDemo.tsx`
- Modify: `landing/components/DemoScroll.tsx`

- [ ] **Step 1: Read ScrollDemo and DemoScroll to find render branches**

Read both files. Identify:
- Server-rendered fallback before `useEffect` runs
- Loading state (if async data)
- Empty state (if data shape is conditional)

- [ ] **Step 2: Verify SSR fallback is meaningful**

If the components rely entirely on client-side mount, the initial HTML render should still produce visible content (e.g., placeholder divs, descriptive text, skeleton boxes).

- [ ] **Step 3: Add skeleton if missing**

If a placeholder is missing, add one. Example:

```tsx
<div className="aspect-video w-full rounded-md bg-muted animate-pulse" aria-label="Loading demo">
  <span className="sr-only">Loading scroll demo...</span>
</div>
```

(Wrap the actual demo in a state-gated render so skeleton shows first.)

- [ ] **Step 4: Verify manually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
DevTools → Network → throttle to "Slow 3G" → reload → verify skeleton appears before demo mounts.

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/ScrollDemo.tsx landing/components/DemoScroll.tsx
git commit -m "fix(perf): add loading skeleton to scroll demo"
```

(Or skip if no changes needed.)

---

## Task 4.6: Mobile collapse recheck

**Files:**
- Read-only verification of all section files

- [ ] **Step 1: List all section files**

Identify all files under `landing/components/sections/`. Read each one and verify:

- Multi-column layouts use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- Below 768px (`< sm` or `< md`), layouts collapse to single column
- No fixed widths that exceed mobile viewport

- [ ] **Step 2: Open DevTools mobile emulation and scroll every section**

DevTools → iPhone 14 Pro emulation (393×852) → scroll the entire page. Verify:
- No horizontal scrollbar appears at any section
- Every grid collapses cleanly to 1 column (or 2 if design intent)
- Text doesn't overflow its container

- [ ] **Step 3: Fix any overflow issues**

If a section overflows:
- Add `w-full` to outer container
- Add `min-w-0` to flex children that contain text
- Add `whitespace-normal` or `break-words` to text in fixed-width containers
- Replace fixed widths (`w-[500px]`) with responsive (`w-full md:w-[500px]`)

- [ ] **Step 4: Verify with e2e mobile-no-overflow spec**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e mobile-no-overflow`
Expected: PASS for all pages.

- [ ] **Step 5: Commit (if any fixes)**

```bash
cd D:/SmoothScroll
git add landing/components/sections/
git commit -m "fix(mobile): recheck and fix section overflow on small viewports"
```

---

## Task 4.7: Final pre-flight verification

**Files:**
- Read-only verification across the entire `landing/` folder

- [ ] **Step 1: Run design-taste pre-flight checklist (spec Section 7)**

Walk through each checkbox from `docs/superpowers/specs/2026-07-08-smoothscroll-landing-audit-redesign-design.md` Section 7. Tick every box. For any box that fails, file a follow-up task and fix.

- [ ] **Step 2: Run all tests one final time**

```bash
cd D:/SmoothScroll/landing
pnpm build
pnpm test
pnpm test:e2e
```

All three green.

- [ ] **Step 3: Manual Lighthouse pass**

Open `http://localhost:3000/en/` in Chrome.
DevTools → Lighthouse → check Accessibility, Best Practices, SEO. All ≥95.

For Performance: target ≥85 on mobile (4G throttle).

- [ ] **Step 4: Manual visual snapshot**

Take screenshots at 320, 390, 768, 1024, 1440, 1920 viewports. Compare against spec design intent.

- [ ] **Step 5: Final commit (if any fixes from pre-flight)**

```bash
cd D:/SmoothScroll
git add -A
git commit -m "chore: pre-flight final cleanup"
```

---

## Task 4.8: Optional visual regression spec

**Files:**
- Create: `landing/e2e/visual-regression.spec.ts`

This is optional. Playwright `toHaveScreenshot` requires careful baseline management. Skip if the project doesn't already use visual regression.

- [ ] **Step 1: Create spec**

```ts
import { test, expect } from '@playwright/test'

test.describe('Visual regression', () => {
  test('home page desktop 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/en/')
    await expect(page).toHaveScreenshot('home-desktop.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('home page mobile 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/en/')
    await expect(page).toHaveScreenshot('home-mobile.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })
})
```

- [ ] **Step 2: Generate baseline**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e visual-regression --update-snapshots`
Expected: baselines created.

- [ ] **Step 3: Re-run to verify**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e visual-regression`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/e2e/visual-regression.spec.ts landing/e2e/visual-regression.spec.ts-snapshots/
git commit -m "test(e2e): add visual regression snapshots"
```

---

## Sprint 4 Verification Gate

- [ ] **Build green**
- [ ] **Unit tests green**
- [ ] **E2E tests green** (including visual regression if added)
- [ ] **Lighthouse a11y ≥95, perf ≥85, SEO ≥95, best-practices ≥95**
- [ ] **Design-taste pre-flight checklist fully ticked**
- [ ] **Spec Section 7 boxes all green**

---

## Sprint 4 Done Definition

- All 8 tasks (4.1-4.8) committed
- `pnpm build` green
- `pnpm test` green
- `pnpm test:e2e` green
- Lighthouse targets met
- Pre-flight checklist complete

---

## Project-Wide Done Definition

All 4 sprints complete AND:

- [ ] Run `cd D:/SmoothScroll && pnpm install` to verify lockfile resolves
- [ ] Run `cd D:/SmoothScroll/landing && pnpm build` for final static export
- [ ] Run `cd D:/SmoothScroll/landing && pnpm start` to preview
- [ ] Manual QA on viewports 320, 390, 768, 1024, 1440
- [ ] Manual QA in both light and dark themes
- [ ] Manual QA with reduced-motion enabled
- [ ] Report final scores: a11y, perf, SEO, best-practices
- [ ] Handoff to user per `build-locally-before-push.mdc` rule: provide path to built artifacts and let user test before any push to master

No push to `master` until user has tested locally.