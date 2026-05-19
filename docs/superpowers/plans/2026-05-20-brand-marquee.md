# Brand Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a horizontally scrolling row of 16 brand logos (with names) directly under the Hero `trustLine`, showing apps/OS where SmoothScroll works well.

**Architecture:** Pure CSS marquee animation (no JS). Brand metadata in `lib/brands.ts`, presentational `<BrandMarquee />` client component, theme-aware brand colors via `dark:` Tailwind classes, edge mask for fade in/out.

**Tech Stack:** Next.js 15, React 18, Tailwind CSS, simple-icons npm package, vitest + @testing-library/react.

**Spec:** [docs/superpowers/specs/2026-05-20-brand-marquee-design.md](../specs/2026-05-20-brand-marquee-design.md)

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `landing/package.json` | Modify | Add `simple-icons` dependency |
| `landing/lib/brands.ts` | Create | Brand list + `Brand` type |
| `landing/lib/brands.test.ts` | Create | Brand list shape test |
| `landing/components/BrandMarquee.tsx` | Create | Marquee component |
| `landing/components/BrandMarquee.test.tsx` | Create | Component tests |
| `landing/app/globals.css` | Modify | Keyframe + `.brand-marquee-track` utility |
| `landing/components/sections/Hero.tsx` | Modify | Mount `<BrandMarquee />` under trustLine |

---

## Task 1: Add simple-icons dependency and verify slugs

**Files:**
- Modify: `landing/package.json`

- [ ] **Step 1: Install package**

Run from `landing/`:

```bash
npm install simple-icons
```

Expected: `simple-icons` appears in `dependencies`.

- [ ] **Step 2: Verify all 16 slugs resolve**

Run from `landing/` (one-shot Node script in shell):

```bash
node -e "
const slugs = ['windows11','apple','googlechrome','microsoftedge','firefoxbrowser','visualstudiocode','cursor','intellijidea','webstorm','pycharm','microsoftword','microsoftexcel','notion','slack','figma','discord'];
const missing = [];
for (const s of slugs) {
  try { require('simple-icons/icons/' + s); }
  catch (e) { missing.push(s); }
}
console.log('Missing:', missing.length ? missing : 'none');
"
```

Expected: `Missing: none`.

If any slug is missing, replace with the working alternative slug from `simple-icons` (search `node_modules/simple-icons/icons/` for the actual filename) and update Task 2 brand list accordingly. **Do not proceed until all 16 resolve.**

- [ ] **Step 3: Commit**

```bash
git add landing/package.json landing/package-lock.json
git commit -m "chore(landing): add simple-icons dependency"
```

---

## Task 2: Create brand list module

**Files:**
- Create: `landing/lib/brands.ts`
- Test: `landing/lib/brands.test.ts`

- [ ] **Step 1: Write the failing test**

Create `landing/lib/brands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BRANDS } from './brands'

describe('brands', () => {
  it('exports exactly 16 entries', () => {
    expect(BRANDS).toHaveLength(16)
  })

  it('every entry has name, slug, hexLight, hexDark', () => {
    for (const b of BRANDS) {
      expect(b.name).toMatch(/.+/)
      expect(b.slug).toMatch(/^[a-z0-9]+$/)
      expect(b.hexLight).toMatch(/^#[0-9A-F]{6}$/i)
      expect(b.hexDark).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('slugs are unique', () => {
    const slugs = BRANDS.map((b) => b.slug)
    expect(new Set(slugs).size).toBe(BRANDS.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `landing/`:

```bash
npx vitest run lib/brands.test.ts
```

Expected: FAIL with "Cannot find module './brands'".

- [ ] **Step 3: Implement brand list**

Create `landing/lib/brands.ts`:

```typescript
export interface Brand {
  name: string
  slug: string
  hexLight: string
  hexDark: string
}

export const BRANDS: Brand[] = [
  { name: 'Windows 11',     slug: 'windows11',         hexLight: '#0078D4', hexDark: '#0078D4' },
  { name: 'macOS',          slug: 'apple',             hexLight: '#1D1D1F', hexDark: '#F5F5F7' },
  { name: 'Chrome',         slug: 'googlechrome',      hexLight: '#4285F4', hexDark: '#4285F4' },
  { name: 'Edge',           slug: 'microsoftedge',     hexLight: '#0078D4', hexDark: '#0078D4' },
  { name: 'Firefox',        slug: 'firefoxbrowser',    hexLight: '#FF7139', hexDark: '#FF7139' },
  { name: 'VS Code',        slug: 'visualstudiocode',  hexLight: '#007ACC', hexDark: '#007ACC' },
  { name: 'Cursor',         slug: 'cursor',            hexLight: '#1D1D1F', hexDark: '#F5F5F7' },
  { name: 'IntelliJ IDEA',  slug: 'intellijidea',      hexLight: '#000000', hexDark: '#FE2857' },
  { name: 'WebStorm',       slug: 'webstorm',          hexLight: '#000000', hexDark: '#07C3F2' },
  { name: 'PyCharm',        slug: 'pycharm',           hexLight: '#21D789', hexDark: '#21D789' },
  { name: 'Word',           slug: 'microsoftword',     hexLight: '#2B579A', hexDark: '#2B579A' },
  { name: 'Excel',          slug: 'microsoftexcel',    hexLight: '#217346', hexDark: '#217346' },
  { name: 'Notion',         slug: 'notion',            hexLight: '#1D1D1F', hexDark: '#FFFFFF' },
  { name: 'Slack',          slug: 'slack',             hexLight: '#4A154B', hexDark: '#ECB22E' },
  { name: 'Figma',          slug: 'figma',             hexLight: '#F24E1E', hexDark: '#F24E1E' },
  { name: 'Discord',        slug: 'discord',           hexLight: '#5865F2', hexDark: '#5865F2' },
]
```

If Task 1 Step 2 found different slug names, replace the slug values above accordingly. Names and hex colors stay.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/brands.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add landing/lib/brands.ts landing/lib/brands.test.ts
git commit -m "feat(landing): add brand list for Hero marquee"
```

---

## Task 3: Add marquee CSS keyframe and utility class

**Files:**
- Modify: `landing/app/globals.css`

- [ ] **Step 1: Append keyframe + utility**

Append to the end of `landing/app/globals.css`:

```css
@layer utilities {
  @keyframes brand-marquee-slide {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-50%, 0, 0); }
  }

  .brand-marquee-track {
    animation: brand-marquee-slide 40s linear infinite;
    will-change: transform;
  }

  .brand-marquee-glyph {
    color: var(--brand-light);
  }

  :where(.dark) .brand-marquee-glyph {
    color: var(--brand-dark);
  }

  .brand-marquee-mask {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      black 64px,
      black calc(100% - 64px),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      black 64px,
      black calc(100% - 64px),
      transparent 100%
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-marquee-track {
      animation: none;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/app/globals.css
git commit -m "feat(landing): add brand marquee animation utilities"
```

---

## Task 4: Create BrandMarquee component (TDD)

**Files:**
- Create: `landing/components/BrandMarquee.tsx`
- Test: `landing/components/BrandMarquee.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `landing/components/BrandMarquee.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BrandMarquee } from './BrandMarquee'
import { BRANDS } from '@/lib/brands'

describe('BrandMarquee', () => {
  it('renders every brand twice (16 × 2 = 32 items)', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    expect(items.length).toBe(BRANDS.length * 2)
  })

  it('first copy is announced to screen readers, second is aria-hidden', () => {
    const { container } = render(<BrandMarquee />)
    const copies = container.querySelectorAll('[data-brand-copy]')
    expect(copies.length).toBe(2)
    expect(copies[0].getAttribute('aria-hidden')).toBeNull()
    expect(copies[1].getAttribute('aria-hidden')).toBe('true')
  })

  it('every item has aria-label with brand name', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    for (const el of Array.from(items)) {
      const label = el.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(BRANDS.map((b) => b.name)).toContain(label)
    }
  })

  it('every item contains an svg', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    for (const el of Array.from(items)) {
      expect(el.querySelector('svg')).not.toBeNull()
    }
  })

  it('renders the marquee track with the animation class', () => {
    const { container } = render(<BrandMarquee />)
    const track = container.querySelector('.brand-marquee-track')
    expect(track).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/BrandMarquee.test.tsx
```

Expected: FAIL with "Cannot find module './BrandMarquee'".

- [ ] **Step 3: Implement BrandMarquee**

Create `landing/components/BrandMarquee.tsx`:

```tsx
'use client'

import type { CSSProperties } from 'react'
import { BRANDS, type Brand } from '@/lib/brands'

import siWindows11 from 'simple-icons/icons/windows11'
import siApple from 'simple-icons/icons/apple'
import siGoogleChrome from 'simple-icons/icons/googlechrome'
import siMicrosoftEdge from 'simple-icons/icons/microsoftedge'
import siFirefoxBrowser from 'simple-icons/icons/firefoxbrowser'
import siVisualStudioCode from 'simple-icons/icons/visualstudiocode'
import siCursor from 'simple-icons/icons/cursor'
import siIntelliJIDEA from 'simple-icons/icons/intellijidea'
import siWebStorm from 'simple-icons/icons/webstorm'
import siPyCharm from 'simple-icons/icons/pycharm'
import siMicrosoftWord from 'simple-icons/icons/microsoftword'
import siMicrosoftExcel from 'simple-icons/icons/microsoftexcel'
import siNotion from 'simple-icons/icons/notion'
import siSlack from 'simple-icons/icons/slack'
import siFigma from 'simple-icons/icons/figma'
import siDiscord from 'simple-icons/icons/discord'

interface SimpleIcon {
  title: string
  slug: string
  path: string
  hex: string
}

const ICON_BY_SLUG: Record<string, SimpleIcon> = {
  windows11: siWindows11,
  apple: siApple,
  googlechrome: siGoogleChrome,
  microsoftedge: siMicrosoftEdge,
  firefoxbrowser: siFirefoxBrowser,
  visualstudiocode: siVisualStudioCode,
  cursor: siCursor,
  intellijidea: siIntelliJIDEA,
  webstorm: siWebStorm,
  pycharm: siPyCharm,
  microsoftword: siMicrosoftWord,
  microsoftexcel: siMicrosoftExcel,
  notion: siNotion,
  slack: siSlack,
  figma: siFigma,
  discord: siDiscord,
}

function BrandItem({ brand }: { brand: Brand }) {
  const icon = ICON_BY_SLUG[brand.slug]
  const style = {
    '--brand-light': brand.hexLight,
    '--brand-dark': brand.hexDark,
  } as CSSProperties

  return (
    <li
      data-brand-item
      role="listitem"
      aria-label={brand.name}
      style={style}
      className="brand-marquee-item inline-flex items-center gap-2 shrink-0"
    >
      <span className="inline-flex items-center justify-center brand-marquee-glyph">
        {icon ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d={icon.path} />
          </svg>
        ) : (
          <span className="block h-5 w-5 rounded-sm bg-current" aria-hidden="true" />
        )}
      </span>
      <span className="text-sm font-medium text-muted-foreground/85">
        {brand.name}
      </span>
    </li>
  )
}

function BrandRow({ ariaHidden }: { ariaHidden: boolean }) {
  return (
    <ul
      data-brand-copy
      {...(ariaHidden ? { 'aria-hidden': true } : {})}
      role="list"
      className="flex items-center gap-10 shrink-0 px-5"
    >
      {BRANDS.map((b) => (
        <BrandItem key={b.slug} brand={b} />
      ))}
    </ul>
  )
}

export function BrandMarquee() {
  return (
    <div
      className="relative overflow-hidden py-6 brand-marquee-mask pointer-events-none select-none"
      role="region"
      aria-label="Compatible apps and operating systems"
    >
      <div className="brand-marquee-track flex w-max items-center">
        <BrandRow ariaHidden={false} />
        <BrandRow ariaHidden />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/BrandMarquee.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add landing/components/BrandMarquee.tsx landing/components/BrandMarquee.test.tsx
git commit -m "feat(landing): add BrandMarquee component"
```

---

## Task 5: Mount BrandMarquee in Hero

**Files:**
- Modify: `landing/components/sections/Hero.tsx`

- [ ] **Step 1: Add import**

In `landing/components/sections/Hero.tsx`, add this import below the existing `DownloadCTA` import:

```tsx
import { BrandMarquee } from '@/components/BrandMarquee'
```

- [ ] **Step 2: Render BrandMarquee under trustLine**

In `landing/components/sections/Hero.tsx`, find the line:

```tsx
<p className="text-sm text-muted-foreground">{h.trustLine}</p>
```

Add `<BrandMarquee />` immediately AFTER that line (still inside the same `<div className="flex flex-col gap-6">` parent):

```tsx
<p className="text-sm text-muted-foreground">{h.trustLine}</p>
<BrandMarquee />
```

- [ ] **Step 3: Type-check**

Run from `landing/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests pass (existing + 8 new from Tasks 2, 4).

- [ ] **Step 5: Visual smoke test**

Run from `landing/`:

```bash
npm run dev
```

Open `http://localhost:3000/en` in a browser. Verify:

1. Logo row visible directly under "trustLine" copy in Hero
2. Logos scroll continuously leftward
3. Edge fade visible at left/right
4. Each logo shows its brand color + brand name in muted text
5. Toggle to dark theme — Cursor / Apple / IntelliJ / WebStorm / Notion logos remain visible
6. Open DevTools, set "Emulate CSS prefers-reduced-motion: reduce" — animation stops, row is static
7. Hard reload — no console errors

If any logo is invisible against background or any animation glitches, file an issue and adjust hex values in `lib/brands.ts`. Do not proceed without visual confirmation.

- [ ] **Step 6: Commit**

```bash
git add landing/components/sections/Hero.tsx
git commit -m "feat(landing): mount BrandMarquee under Hero trustLine"
```

---

## Task 6: Production build verification

**Files:** none

- [ ] **Step 1: Run production build**

Run from `landing/`:

```bash
npm run build
```

Expected: build completes without errors. No new warnings from BrandMarquee.

- [ ] **Step 2: Inspect bundle size**

Look at the build output for the `[lang]/page` chunk. Note the new size. Compared to before the marquee, increase should be < 25 KB gzipped (16 brand SVG paths from simple-icons).

If the increase exceeds 50 KB, investigate why simple-icons isn't tree-shaking and switch the import strategy in `BrandMarquee.tsx` to direct path imports per icon. Do not commit a regression.

- [ ] **Step 3: Final commit (only if any fixes were needed)**

If no fixes needed, no commit. Otherwise:

```bash
git add -p landing/
git commit -m "perf(landing): tree-shake simple-icons in BrandMarquee"
```

---

## Verification Checklist

After Task 6:

- [ ] All vitest tests pass (`npx vitest run`)
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` clean
- [ ] Visual: 16 logos visible, scrolling, edge mask present, both themes look right
- [ ] Reduced motion: marquee static
- [ ] No browser console errors
