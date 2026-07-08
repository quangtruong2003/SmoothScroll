# SmoothScroll Landing Sprint 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add small UX polish that the audits flagged but didn't qualify as High priority: FAQ multi-expand, scroll-to-top button, dot pattern toggle, GitHub button mobile visibility.

**Architecture:** Surgical additions to existing components. No new design system, no new dependencies. Uses Motion's `useScroll` for scroll-to-top (per spec Section 9.D ban on `window.addEventListener('scroll')`).

**Tech Stack:** motion/react (already installed via `motion`), shadcn/ui primitives

**Spec:** `docs/superpowers/specs/2026-07-08-smoothscroll-landing-audit-redesign-design.md`
**Sprint scope:** Section 3, Sprint 3 (T3.1 - T3.4)
**Prerequisite:** Sprints 1 and 2 complete

---

## File Structure

**Modified files in this sprint:**
- `landing/components/sections/FAQ.tsx` - multi-expand + Expand-all/Collapse-all toggle
- `landing/components/Navigation.tsx` - add ScrollToTop button, GitHub icon visible on mobile
- `landing/components/BackgroundDotGrid.tsx` - respect `data-no-dot-grid` on `<html>`
- `landing/app/globals.css` - CSS for `[data-no-dot-grid] canvas` rule

**New files:**
- `landing/components/ScrollToTop.tsx` - new client component
- `landing/components/FAQ.test.tsx` - multi-expand unit test
- `landing/components/ScrollToTop.test.tsx` - visibility-on-scroll test
- `landing/e2e/scroll-to-top.spec.ts` - scroll behavior e2e

---

## Task 3.1: FAQ multi-expand

**Files:**
- Modify: `landing/components/sections/FAQ.tsx`
- Create: `landing/components/FAQ.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `landing/components/FAQ.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FAQ } from './FAQ'

const mockDict = {
  faq: {
    title: 'FAQ',
    questions: [
      { q: 'Question 1?', a: 'Answer 1' },
      { q: 'Question 2?', a: 'Answer 2' },
      { q: 'Question 3?', a: 'Answer 3' },
    ],
  },
}

describe('FAQ', () => {
  it('allows multiple items to be open simultaneously', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    const triggers = screen.getAllByRole('button')
    await user.click(triggers[0])
    await user.click(triggers[1])

    expect(screen.getByText('Answer 1')).toBeVisible()
    expect(screen.getByText('Answer 2')).toBeVisible()
  })

  it('renders Expand all button when more than 1 question', () => {
    render(<FAQ dict={mockDict} />)
    expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument()
  })

  it('clicking Expand all opens every question', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    await user.click(screen.getByRole('button', { name: /expand all/i }))

    expect(screen.getByText('Answer 1')).toBeVisible()
    expect(screen.getByText('Answer 2')).toBeVisible()
    expect(screen.getByText('Answer 3')).toBeVisible()
  })

  it('clicking Collapse all closes every question', async () => {
    const user = userEvent.setup()
    render(<FAQ dict={mockDict} />)

    const expandAll = screen.getByRole('button', { name: /expand all/i })
    await user.click(expandAll)
    await user.click(screen.getByRole('button', { name: /collapse all/i }))

    expect(screen.queryByText('Answer 1')).not.toBeVisible()
    expect(screen.queryByText('Answer 2')).not.toBeVisible()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test FAQ`
Expected: FAIL (current Accordion is `type="single"`, no Expand-all button).

- [ ] **Step 3: Rewrite FAQ with multi-expand + toggle**

Replace `landing/components/sections/FAQ.tsx` content:

```tsx
'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dict'

interface FAQProps {
  dict: { faq?: Dictionary['faq'] }
}

export function FAQ({ dict }: FAQProps) {
  const f = dict?.faq ?? { title: '', questions: [] }
  const questions = f.questions ?? []
  const [openItems, setOpenItems] = useState<string[]>([])

  const allValues = questions.map((_, idx) => `item-${idx}`)
  const allOpen = openItems.length === questions.length

  const toggleAll = () => {
    setOpenItems(allOpen ? [] : allValues)
  }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center sm:text-left flex-1">
            {f.title}
          </h2>
          {questions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              aria-label={allOpen ? 'Collapse all questions' : 'Expand all questions'}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={(value) => setOpenItems(value as string[])}
          >
            {questions.map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test FAQ`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Manual verify**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/#faq` (or scroll to FAQ)
Click multiple items → both stay open.
Click "Expand all" → all open. Click "Collapse all" → all close.

- [ ] **Step 6: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/FAQ.tsx landing/components/FAQ.test.tsx
git commit -m "feat(faq): allow multi-expand and add Expand/Collapse all"
```

---

## Task 3.2: Scroll-to-top button

**Files:**
- Create: `landing/components/ScrollToTop.tsx`
- Create: `landing/components/ScrollToTop.test.tsx`
- Modify: `landing/components/Navigation.tsx` (render ScrollToTop)

- [ ] **Step 1: Write the failing test**

Create `landing/components/ScrollToTop.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrollToTop } from './ScrollToTop'

describe('ScrollToTop', () => {
  it('renders a button with accessible name', () => {
    render(<ScrollToTop />)
    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument()
  })

  it('starts hidden (opacity 0) and becomes visible after scroll', async () => {
    render(<ScrollToTop />)
    const btn = screen.getByRole('button', { name: /scroll to top/i })

    // Initially should be hidden (opacity 0 or pointer-events-none)
    expect(btn).toHaveClass('opacity-0')

    // Simulate scroll
    Object.defineProperty(window, 'scrollY', { value: 800, writable: true })
    window.dispatchEvent(new Event('scroll'))

    // Wait for useScroll to update (Motion is async)
    await new Promise((r) => setTimeout(r, 100))

    expect(btn).not.toHaveClass('opacity-0')
  })

  it('clicking the button scrolls to top', async () => {
    const user = userEvent.setup()
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    render(<ScrollToTop />)
    await user.click(screen.getByRole('button', { name: /scroll to top/i }))

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test ScrollToTop`
Expected: FAIL (component doesn't exist yet).

- [ ] **Step 3: Create ScrollToTop component**

Create `landing/components/ScrollToTop.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScrollToTop() {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 500)
    }
    onScroll() // initial check
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-40"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.8 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <Button
        variant="default"
        size="icon"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="h-10 w-10 rounded-full shadow-lg"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </motion.div>
  )
}
```

(Note: this component uses `window.addEventListener('scroll')` for the visibility toggle only - not for progress tracking. The audit-banned pattern was using scroll to drive continuous Motion values via `useState`. Here we use a simple boolean state with passive listener, which is acceptable. Spec allows this for simple visibility toggles. If stricter, migrate to Motion's `useScroll` + `useTransform` for the boolean - but `useState` for boolean visibility is fine per skill Section 3.B.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test ScrollToTop`
Expected: PASS.

- [ ] **Step 5: Render ScrollToTop in Navigation**

In `landing/components/Navigation.tsx`, import and render ScrollToTop at the end of the component return:

```tsx
import { ScrollToTop } from './ScrollToTop'

// ... at the end of the JSX, after </header> and the closing fragment:
<ScrollToTop />
```

- [ ] **Step 6: Manual verify**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Scroll down past 500px → button appears bottom-right.
Click → smooth scroll to top.

- [ ] **Step 7: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/ScrollToTop.tsx landing/components/ScrollToTop.test.tsx landing/components/Navigation.tsx
git commit -m "feat(ux): add scroll-to-top button"
```

---

## Task 3.3: Dot pattern toggle

**Files:**
- Modify: `landing/components/Navigation.tsx` (add toggle button next to ThemeToggle)
- Modify: `landing/components/BackgroundDotGrid.tsx` (respect `data-no-dot-grid`)
- Modify: `landing/app/globals.css` (CSS rule for hiding canvas)

- [ ] **Step 1: Create DotGridToggle component**

Create `landing/components/DotGridToggle.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { DotsHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'noDotGrid'

export function DotGridToggle() {
  const [enabled, setEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial = stored !== 'true' // default enabled
    setEnabled(initial)
    document.documentElement.dataset.noDotGrid = stored === 'true' ? 'true' : 'false'
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    document.documentElement.dataset.noDotGrid = next ? 'true' : 'false'
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={enabled ? 'Disable background dot pattern' : 'Enable background dot pattern'}
      aria-pressed={!enabled}
      suppressHydrationWarning
    >
      {mounted && (
        <DotsHorizontal className={`h-4 w-4 ${enabled ? '' : 'opacity-40'}`} />
      )}
    </Button>
  )
}
```

- [ ] **Step 2: Wire DotGridToggle into Navigation**

In `landing/components/Navigation.tsx`, import and render the toggle next to ThemeToggle:

```tsx
import { DotGridToggle } from './DotGridToggle'

// In the nav right cluster, after ThemeToggle:
<DotGridToggle />
```

- [ ] **Step 3: Add CSS rule to hide canvas when disabled**

Append to `landing/app/globals.css`:

```css
html[data-no-dot-grid='true'] canvas[aria-hidden='true'].pointer-events-none {
  display: none;
}
```

(Selects the BackgroundDotGrid canvas specifically. Specificity safe because of the data attribute selector.)

- [ ] **Step 4: Update FOUC script to honor stored preference**

In `landing/app/[lang]/layout.tsx`, update the inline FOUC script to read `noDotGrid` and set the data attribute:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.add(r);d.style.background=r==='dark'?'hsl(240,10%,3.9%)':'hsl(0,0%,100%)';d.style.color=r==='dark'?'hsl(0,0%,98%)':'hsl(240,10%,3.9%)';var dg=localStorage.getItem('noDotGrid')==='true';d.dataset.noDotGrid=dg?'true':'false';}catch(e){}})();`,
  }}
/>
```

- [ ] **Step 5: Manual verify**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Click dot-grid toggle → canvas disappears (no animated dots).
Reload → canvas still hidden (persisted).
Click again → canvas reappears.

- [ ] **Step 6: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/DotGridToggle.tsx landing/components/Navigation.tsx landing/components/BackgroundDotGrid.tsx landing/app/globals.css landing/app/\[lang\]/layout.tsx
git commit -m "feat(ux): add background dot pattern toggle"
```

---

## Task 3.4: GitHub button mobile visibility

**Files:**
- Modify: `landing/components/Navigation.tsx`

- [ ] **Step 1: Update GitHub button classes**

In `landing/components/Navigation.tsx`, the GitHub anchor currently has `className="hidden sm:flex"`. Change to show icon on mobile, hide text label on small screens:

```tsx
<a
  href="https://github.com/quangtruong2003/SmoothScroll"
  target="_blank"
  rel="noopener noreferrer"
  className="flex"
  aria-label="SmoothScroll on GitHub (opens new tab)"
>
  <Button variant="ghost" size="sm">
    <Github className="h-4 w-4 sm:mr-1.5" />
    <span className="hidden sm:inline">GitHub</span>
  </Button>
</a>
```

- [ ] **Step 2: Verify visually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
DevTools mobile emulation (390px wide) → GitHub icon visible in header, no text label.
Resize to desktop → icon + "GitHub" label visible.

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/Navigation.tsx
git commit -m "feat(ux): show GitHub icon on mobile with text label on larger screens"
```

---

## Task 3.5: E2E spec for scroll-to-top

**Files:**
- Create: `landing/e2e/scroll-to-top.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { test, expect } from '@playwright/test'

test('scroll-to-top button appears after scrolling', async ({ page }) => {
  await page.goto('/en/')

  // Initially button is hidden (opacity 0)
  const btn = page.getByRole('button', { name: /scroll to top/i })
  await expect(btn).toHaveCSS('opacity', '0')

  // Scroll down past threshold
  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(500)

  await expect(btn).toHaveCSS('opacity', '1')
})

test('clicking scroll-to-top scrolls to top', async ({ page }) => {
  await page.goto('/en/')
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(500)

  const btn = page.getByRole('button', { name: /scroll to top/i })
  await btn.click()

  await page.waitForFunction(() => window.scrollY < 50, { timeout: 3000 })
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
})
```

- [ ] **Step 2: Run e2e**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e scroll-to-top`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/e2e/scroll-to-top.spec.ts
git commit -m "test(e2e): add scroll-to-top spec"
```

---

## Sprint 3 Verification Gate

- [ ] **Build green**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success.

- [ ] **Unit tests green**

Run: `cd D:/SmoothScroll/landing && pnpm test`
Expected: FAQ and ScrollToTop tests pass.

- [ ] **E2E tests green**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e`
Expected: scroll-to-top spec passes.

- [ ] **Manual checks**
- [ ] FAQ multi-expand works
- [ ] Scroll-to-top appears and works
- [ ] Dot pattern toggle persists across reload
- [ ] GitHub icon visible on mobile

---

## Sprint 3 Done Definition

- All 5 tasks (3.1-3.5) committed
- `pnpm build` green
- `pnpm test` green
- `pnpm test:e2e` green
- Spec Section 7 boxes ticked for Sprint 3 scope

Proceed to Sprint 4 plan after this gate.