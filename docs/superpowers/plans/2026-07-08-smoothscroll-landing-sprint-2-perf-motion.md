# SmoothScroll Landing Sprint 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate external icon CDN dependency, optimize GIF assets, honor `prefers-reduced-motion` for canvas and marquee animations.

**Architecture:** BackgroundDotGrid already reads `prefers-reduced-motion` but does not use the value; fix that with a single conditional. BrandMarquee reduced-motion + hover-pause via CSS only. Iconify migration uses a one-time fetch script (no npm dep). GIF optimization via ffmpeg locally (skip if unavailable; document fallback).

**Tech Stack:** Node.js (fetch script), ffmpeg (optional, local), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-07-08-smoothscroll-landing-audit-redesign-design.md`
**Sprint scope:** Section 3, Sprint 2 (T2.1 - T2.6)
**Prerequisite:** Sprint 1 complete and merged

---

## File Structure

**Modified files in this sprint:**
- `landing/components/BackgroundDotGrid.tsx` - actually use `reduced` variable
- `landing/app/globals.css` - append marquee reduced-motion + hover-pause rules
- `landing/lib/brands.ts` - point to local SVG paths instead of Iconify URLs
- `landing/components/sections/ScrollDemo.tsx` - use `<picture>` for GIF/WebM with lazy loading

**New files:**
- `landing/scripts/fetch-brand-icons.mjs` - one-time fetch script
- `landing/public/assets/brand-icons/*.svg` - 16 brand SVG files
- `landing/public/assets/before-after/before.webm` and `after.webm` (if ffmpeg available)
- `landing/lib/dotGrid.test.ts` - reduced-motion unit test
- `landing/lib/brands.test.ts` - local-paths assertion
- `landing/e2e/reduced-motion.spec.ts` - canvas + marquee behavior
- `landing/e2e/no-external-icons.spec.ts` - network interception

---

## Task 2.1: Fix BackgroundDotGrid reduced-motion (use the variable)

**Files:**
- Modify: `landing/components/BackgroundDotGrid.tsx`

The component already reads `reduced` from `matchMedia('(prefers-reduced-motion: reduce)')` on line 114 but never uses it. The intent is: when reduced-motion is on, skip RAF and only render static dots once.

- [ ] **Step 1: Write the failing test**

Create `landing/lib/dotGrid.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock canvas APIs
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getContext: vi.fn(),
  })) as any
})

describe('BackgroundDotGrid reduced-motion', () => {
  it('does not start animation loop when prefers-reduced-motion: reduce', async () => {
    const matchMediaMock = vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0 as any)

    const { BackgroundDotGrid } = await import('@/components/BackgroundDotGrid')
    render(<BackgroundDotGrid />)

    // Wait one tick for useEffect
    await new Promise((r) => setTimeout(r, 0))

    expect(rafSpy).not.toHaveBeenCalled()
    rafSpy.mockRestore()
  })
})
```

(Use Testing Library's `render`. Import: `import { render } from '@testing-library/react'`. Add to top of file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test dotGrid`
Expected: FAIL - current code calls `requestAnimationFrame` unconditionally.

- [ ] **Step 3: Implement the fix**

In `landing/components/BackgroundDotGrid.tsx`, find the `useEffect` block. Locate the line:

```ts
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

Right after this line, add:

```ts
if (reduced) {
  // Reduced motion: only paint static frame, never animate.
  resize()
  drawStatic()
  // Still observe theme changes so colors update on toggle.
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  colorSchemeQuery.addEventListener('change', onThemeChange)
  const observer = new MutationObserver(onThemeChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  window.addEventListener('resize', onResize)
  return () => {
    colorSchemeQuery.removeEventListener('change', onThemeChange)
    observer.disconnect()
    window.removeEventListener('resize', onResize)
  }
}
```

Then refactor: move `onThemeChange`, `onResize`, `resize`, `drawStatic` declarations ABOVE this early-return so they are in scope. Verify by reading the file end-to-end. If `onThemeChange` is defined further down in the same effect, hoist it via function declaration (already hoisted in TS since it's `function` syntax).

- [ ] **Step 4: Re-read the effect for correctness**

Read the full `useEffect` in `BackgroundDotGrid.tsx` after editing. Confirm:
- `reduced` short-circuits before `kick()` is called
- All event listeners registered in the early-return branch are cleaned up in its return
- Theme change observer still triggers `drawStatic()` so dark mode toggle still updates colors

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test dotGrid`
Expected: PASS.

- [ ] **Step 6: Manual verify**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
OS setting: enable "Reduce motion" (Windows: Settings > Accessibility > Visual effects > Animation effects off).
Reload page → canvas shows static dots, no cursor-following, no animation.
Toggle theme → colors update, still static.
OS setting: disable reduced motion, reload → animation returns.

- [ ] **Step 7: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/BackgroundDotGrid.tsx landing/lib/dotGrid.test.ts
git commit -m "fix(motion): honor prefers-reduced-motion in BackgroundDotGrid"
```

---

## Task 2.2: BrandMarquee reduced-motion + hover-pause

**Files:**
- Modify: `landing/app/globals.css`

The marquee uses CSS keyframe animation `brand-marquee-slide` 40s infinite. Add reduced-motion override and hover-pause.

- [ ] **Step 1: Append marquee rules**

Append to `landing/app/globals.css` (after existing `.brand-marquee-track` rule):

```css
.brand-marquee-track {
  animation: brand-marquee-slide 40s linear infinite;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .brand-marquee-track {
    animation: none;
  }
  .brand-marquee-mask {
    overflow-x: auto;
  }
  .brand-marquee-track {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem 2rem;
  }
}

@media (hover: hover) {
  .brand-marquee-mask:hover .brand-marquee-track {
    animation-play-state: paused;
  }
}
```

(The `@media (hover: hover)` ensures we don't apply pause to touch devices where hover state can stick.)

- [ ] **Step 2: Verify manually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Hover over marquee → animation pauses.
Move cursor away → resumes.
Enable reduced-motion → marquee stops, logos wrap into 4-column grid (if width permits).

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/globals.css
git commit -m "feat(motion): honor reduced-motion and hover-pause for marquee"
```

---

## Task 2.3: Local icon bundle (replace Iconify CDN)

**Files:**
- Create: `landing/scripts/fetch-brand-icons.mjs`
- Create: `landing/public/assets/brand-icons/*.svg` (16 files)
- Modify: `landing/lib/brands.ts`
- Modify: `landing/package.json` (add `prebuild` script)
- Create: `landing/lib/brands.test.ts`

This replaces 16 external iconify requests with 16 local SVG files served from `/assets/brand-icons/`.

- [ ] **Step 1: Create fetch script**

Create `landing/scripts/fetch-brand-icons.mjs`:

```javascript
#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'brand-icons')

const ICONS = [
  { slug: 'microsoft-windows', name: 'windows11' },
  { slug: 'apple', name: 'apple' },
  { slug: 'chrome', name: 'chrome' },
  { slug: 'microsoft-edge', name: 'edge' },
  { slug: 'firefox', name: 'firefox' },
  { slug: 'visual-studio-code', name: 'vscode' },
  { slug: 'cursor', name: 'cursor' },
  { slug: 'intellij-idea', name: 'intellijidea' },
  { slug: 'webstorm', name: 'webstorm' },
  { slug: 'pycharm', name: 'pycharm' },
  { slug: 'file-type-word', name: 'word' },
  { slug: 'file-type-excel', name: 'excel' },
  { slug: 'notion-icon', name: 'notion' },
  { slug: 'slack-icon', name: 'slack' },
  { slug: 'figma', name: 'figma' },
  { slug: 'discord-icon', name: 'discord' },
]

const COLLECTIONS = {
  'microsoft-windows': 'logos',
  apple: 'logos',
  chrome: 'logos',
  'microsoft-edge': 'logos',
  firefox: 'logos',
  'visual-studio-code': 'logos',
  cursor: 'simple-icons',
  'intellij-idea': 'logos',
  webstorm: 'logos',
  pycharm: 'logos',
  'file-type-word': 'vscode-icons',
  'file-type-excel': 'vscode-icons',
  'notion-icon': 'logos',
  'slack-icon': 'logos',
  figma: 'logos',
  'discord-icon': 'logos',
}

async function fetchIcon(collection, slug, outName) {
  const url = `https://api.iconify.design/${collection}/${slug}.svg?download=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  const svg = await res.text()
  const outPath = join(OUT_DIR, `${outName}.svg`)
  await writeFile(outPath, svg, 'utf8')
  console.log(`  ${outName}.svg`)
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true })
  }
  console.log(`Fetching ${ICONS.length} brand icons to ${OUT_DIR}`)
  for (const { slug, name } of ICONS) {
    const collection = COLLECTIONS[slug]
    await fetchIcon(collection, slug, name)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Run fetch script**

Run: `cd D:/SmoothScroll/landing && node scripts/fetch-brand-icons.mjs`
Expected: 16 SVG files written to `landing/public/assets/brand-icons/`. Network requests to `api.iconify.design`.

- [ ] **Step 3: Verify SVGs exist and are valid**

Run: `cd D:/SmoothScroll/landing && ls public/assets/brand-icons/`
Expected: 16 `.svg` files.

Run: `cd D:/SmoothScroll/landing && head -c 100 public/assets/brand-icons/apple.svg`
Expected: starts with `<svg` or `<?xml`.

- [ ] **Step 4: Update brands.ts to use local paths**

Replace `landing/lib/brands.ts` content:

```typescript
export interface Brand {
  name: string
  slug: string
  src: string
  invertOnDark?: boolean
}

const LOCAL = (name: string) => `/assets/brand-icons/${name}.svg`

export const BRANDS: Brand[] = [
  { name: 'Windows 11',    slug: 'windows11',    src: LOCAL('windows11'),    invertOnDark: true },
  { name: 'macOS',         slug: 'apple',        src: LOCAL('apple'),        invertOnDark: true },
  { name: 'Chrome',        slug: 'chrome',       src: LOCAL('chrome') },
  { name: 'Edge',          slug: 'edge',         src: LOCAL('edge') },
  { name: 'Firefox',       slug: 'firefox',      src: LOCAL('firefox') },
  { name: 'VS Code',       slug: 'vscode',       src: LOCAL('vscode') },
  { name: 'Cursor',        slug: 'cursor',       src: LOCAL('cursor'),       invertOnDark: true },
  { name: 'IntelliJ IDEA', slug: 'intellijidea', src: LOCAL('intellijidea') },
  { name: 'WebStorm',      slug: 'webstorm',     src: LOCAL('webstorm') },
  { name: 'PyCharm',       slug: 'pycharm',      src: LOCAL('pycharm') },
  { name: 'Word',          slug: 'word',         src: LOCAL('word') },
  { name: 'Excel',         slug: 'excel',        src: LOCAL('excel') },
  { name: 'Notion',        slug: 'notion',       src: LOCAL('notion'),       invertOnDark: true },
  { name: 'Slack',         slug: 'slack',        src: LOCAL('slack') },
  { name: 'Figma',         slug: 'figma',        src: LOCAL('figma') },
  { name: 'Discord',       slug: 'discord',      src: LOCAL('discord') },
]
```

(Note: `invertOnDark: true` is now applied to Windows, macOS, Cursor, Notion - was previously only some. Verify with grep on original `brands.ts` to keep parity.)

Read original `landing/lib/brands.ts` again to confirm `invertOnDark` flags before replacing. Apply original flags exactly.

- [ ] **Step 5: Add prebuild hook**

In `landing/package.json`, find the `scripts` block. Add `prebuild` and `predev` hooks (optional):

```json
{
  "scripts": {
    "fetch-icons": "node scripts/fetch-brand-icons.mjs",
    "prebuild": "node scripts/fetch-brand-icons.mjs"
  }
}
```

Only add `prebuild`, not `predev` (dev should not re-fetch every time).

- [ ] **Step 6: Write brand test**

Create `landing/lib/brands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BRANDS } from './brands'

describe('BRANDS', () => {
  it('has 16 entries', () => {
    expect(BRANDS).toHaveLength(16)
  })

  it('every brand src is local (starts with /assets/brand-icons/)', () => {
    for (const brand of BRANDS) {
      expect(brand.src).toMatch(/^\/assets\/brand-icons\/.+\.svg$/)
    }
  })

  it('no brand references the Iconify CDN', () => {
    for (const brand of BRANDS) {
      expect(brand.src).not.toContain('iconify.design')
    }
  })

  it('every brand has unique slug', () => {
    const slugs = BRANDS.map((b) => b.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
```

- [ ] **Step 7: Run unit test**

Run: `cd D:/SmoothScroll/landing && pnpm test brands`
Expected: PASS.

- [ ] **Step 8: Verify build**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success. Icons resolve to local paths in static export.

- [ ] **Step 9: Verify Network tab in dev**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
DevTools Network tab → filter `iconify.design` → 0 requests.

- [ ] **Step 10: Commit**

```bash
cd D:/SmoothScroll
git add landing/scripts/fetch-brand-icons.mjs landing/lib/brands.ts landing/lib/brands.test.ts landing/package.json landing/public/assets/brand-icons/
git commit -m "perf(icons): bundle brand SVGs locally, remove Iconify CDN dependency"
```

---

## Task 2.4: GIF optimization (before/after → WebM)

**Files:**
- Modify: `landing/components/sections/ScrollDemo.tsx`
- Create: `landing/public/assets/before-after/before.webm` (if ffmpeg available)
- Create: `landing/public/assets/before-after/after.webm` (if ffmpeg available)

- [ ] **Step 1: Check if ffmpeg is available**

Run: `where ffmpeg` (Windows) or `which ffmpeg`
If available, proceed. If not, skip WebM creation and go to Step 4 (lazy-load only fallback).

- [ ] **Step 2: Convert GIFs to WebM**

Run (replace paths with actual GIF paths from `landing/public/assets/`):

```bash
cd D:/SmoothScroll/landing
ffmpeg -i public/assets/before.gif -c:v libvpx-vp9 -b:v 0 -crf 30 -an public/assets/before-after/before.webm
ffmpeg -i public/assets/after.gif -c:v libvpx-vp9 -b:v 0 -crf 30 -an public/assets/before-after/after.webm
```

Expected: WebM files ~30-50% smaller than GIFs.

- [ ] **Step 3: Update ScrollDemo to use `<picture>` with WebM + GIF fallback**

In `landing/components/sections/ScrollDemo.tsx`, find the GIF usage. Replace each `<img src="...gif">` with:

```tsx
<picture>
  <source srcSet={`${BASE_PATH}/assets/before-after/before.webm`} type="video/webm" />
  <img
    src={`${BASE_PATH}/assets/before.gif`}
    alt="SmoothScroll demo: before (raw Windows scrolling)"
    width={600}
    height={400}
    loading="lazy"
    decoding="async"
  />
</picture>
```

(Repeat for "after" with appropriate alt text. Replace with `<video autoPlay loop muted playsInline>` if GIF fallback is dropped - but `<picture>` is simpler and keeps GIF fallback.)

Adjust alt text per audit spec: include app/feature description.

- [ ] **Step 4: Add lazy loading to GIF fallback too**

The `<img>` inside `<picture>` already has `loading="lazy"` in the snippet above. Verify each `<img>` tag in ScrollDemo has `loading="lazy"` if not in the initial viewport.

- [ ] **Step 5: Verify build**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success.

- [ ] **Step 6: Manual verify file size reduction**

Run: `cd D:/SmoothScroll/landing && ls -la public/assets/before-after/ public/assets/*.gif 2>/dev/null`
Expected: WebM files exist and are smaller than GIFs.

- [ ] **Step 7: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/ScrollDemo.tsx landing/public/assets/before-after/
git commit -m "perf(images): convert demo GIFs to WebM with GIF fallback"
```

If ffmpeg unavailable, skip this task and commit a stub:

```bash
git commit --allow-empty -m "perf(images): skip WebM conversion (ffmpeg unavailable)"
```

---

## Task 2.5: Image preloading hint for hero asset

**Files:**
- Modify: `landing/app/[lang]/layout.tsx`

- [ ] **Step 1: Read current layout and identify hero asset**

The hero visual (system tray mockup or similar) is referenced in `landing/components/sections/Hero.tsx` or a section below. Read both to find the actual image path. Common candidates: `og-image.png`, a hero illustration.

- [ ] **Step 2: Add preload link in [lang]/layout.tsx `<head>`**

In `landing/app/[lang]/layout.tsx`, inside the `<head>` block, add:

```tsx
<link
  rel="preload"
  as="image"
  href="/assets/og-image.png"
  fetchPriority="high"
/>
```

Replace `og-image.png` with the actual hero-critical image if different. Keep OG image as fallback if unsure.

- [ ] **Step 3: Verify with Lighthouse**

Run: `cd D:/SmoothScroll/landing && pnpm build && pnpm start`
Open: `http://localhost:3000/en/`
DevTools Lighthouse → run audit → check "Preload key images" or "Largest Contentful Paint element".

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/\[lang\]/layout.tsx
git commit -m "perf(hero): preload critical hero image"
```

---

## Task 2.6: Verify brand marquee lazy loading

**Files:**
- Modify: `landing/components/BrandMarquee.tsx` (no-op if already correct)

- [ ] **Step 1: Read BrandMarquee.tsx**

Already read in spec exploration. Verify the `<img>` tag has `loading="lazy"`.

- [ ] **Step 2: Add `decoding="async"` if missing**

In `landing/components/BrandMarquee.tsx`, the `<img>` already has `decoding="async"`. Verify by re-reading. If present, no change needed.

- [ ] **Step 3: No-op commit if no changes**

If nothing changed, no commit needed. Otherwise commit a no-op correction.

---

## Task 2.7: E2E specs for Sprint 2

**Files:**
- Create: `landing/e2e/reduced-motion.spec.ts`
- Create: `landing/e2e/no-external-icons.spec.ts`

- [ ] **Step 1: Create reduced-motion.spec.ts**

```ts
import { test, expect } from '@playwright/test'

test.describe('Reduced motion behavior', () => {
  test.use({ colorScheme: 'light' })

  test('BackgroundDotGrid does not animate when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()

    const rafCalls: number[] = []
    await page.exposeFunction('recordRaf', () => rafCalls.push(performance.now()))

    await page.goto('/en/')

    // Patch requestAnimationFrame to count calls after mount
    await page.evaluate(() => {
      const origRaf = window.requestAnimationFrame
      window.requestAnimationFrame = (cb) => {
        ;(window as any).recordRaf()
        return origRaf(cb)
      }
    })

    // Wait 2 seconds and check no raf calls were made (canvas shouldn't animate)
    await page.waitForTimeout(2000)
    expect(rafCalls.length).toBe(0)

    await context.close()
  })

  test('brand-marquee-track has animation: none when prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/en/')

    const animationName = await page.evaluate(() => {
      const track = document.querySelector('.brand-marquee-track') as HTMLElement
      return track ? getComputedStyle(track).animationName : 'no-track'
    })

    expect(animationName).toBe('none')
    await context.close()
  })
})
```

- [ ] **Step 2: Create no-external-icons.spec.ts**

```ts
import { test, expect } from '@playwright/test'

test('home page makes zero requests to iconify.design', async ({ page }) => {
  const externalRequests: string[] = []

  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('iconify.design') || url.includes('api.iconify')) {
      externalRequests.push(url)
    }
  })

  await page.goto('/en/')
  await page.waitForLoadState('networkidle')

  expect(externalRequests).toEqual([])
})
```

- [ ] **Step 3: Run e2e tests**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e`
Expected: all green. If reduced-motion spec fails, verify Tasks 2.1 and 2.2 landed correctly.

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/e2e/reduced-motion.spec.ts landing/e2e/no-external-icons.spec.ts
git commit -m "test(e2e): add reduced-motion and no-external-icons specs"
```

---

## Sprint 2 Verification Gate

- [ ] **Build green**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success, no TS errors.

- [ ] **Unit tests green**

Run: `cd D:/SmoothScroll/landing && pnpm test`
Expected: all tests pass, including `dotGrid.test.ts` and `brands.test.ts`.

- [ ] **E2E tests green**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e`
Expected: reduced-motion, no-external-icons specs pass.

- [ ] **Lighthouse local perf ≥85**

Open DevTools Lighthouse → run perf audit on `/en/` → verify score.

- [ ] **Manual checks**
- [ ] Network tab → 0 external icon requests
- [ ] OS reduced-motion on → marquee static, canvas frozen
- [ ] Hover marquee → animation pauses

---

## Sprint 2 Done Definition

- All 7 tasks (2.1-2.7) committed
- `pnpm build` green
- `pnpm test` green
- `pnpm test:e2e` green
- Lighthouse perf ≥85 locally
- Spec Section 7 boxes ticked for Sprint 2 scope

Proceed to Sprint 3 plan after this gate.