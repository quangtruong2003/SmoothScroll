# SmoothScroll Landing Sprint 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix accessibility foundation bugs (lang attribute, dark mode race, reduced-motion, focus outline, contrast, aria-live, touch support, skip-link) without changing visual design.

**Architecture:** Surgical CSS + a11y attribute additions to existing shadcn/ui primitives. No new components, no dependency additions. Tests use Vitest + Testing Library for unit, Playwright for a11y smoke.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, shadcn/ui, lucide-react, Vitest, Playwright, axe-core/playwright (devDep)

**Spec:** `docs/superpowers/specs/2026-07-08-smoothscroll-landing-audit-redesign-design.md`
**Sprint scope:** Section 3, Sprint 1 (T1.1 - T1.10)

---

## File Structure

**Modified files in this sprint:**
- `landing/app/layout.tsx` - add `lang` to FOUC script
- `landing/app/[lang]/layout.tsx` - set `<html lang={locale}>` via root layout wrapper
- `landing/app/globals.css` - append `:focus-visible` rule + `@media (prefers-reduced-motion)` block
- `landing/components/Navigation.tsx` - add skip-to-content link, GitHub button label
- `landing/components/LangSwitcher.tsx` - convert to click-toggle for touch support, add ARIA menu pattern
- `landing/components/sections/Hero.tsx` - add `transition-colors` for dark-mode sync
- `landing/components/sections/Install.tsx` - add aria-live to CopyButton; add aria-describedby for disabled tabs
- `landing/components/ui/tabs.tsx` - accept and expose `aria-describedby` on TabsTrigger
- `landing/components/Footer.tsx` - distinct aria-label for footer GitHub link

**New test files:**
- `landing/components/LangSwitcher.test.tsx` - touch toggle behavior
- `landing/e2e/a11y-audit.spec.ts` - axe-core smoke on all locales
- `landing/e2e/mobile-no-overflow.spec.ts` - 390px viewport no-horizontal-scroll

**No new dependencies.**

---

## Task 1.1: Set `<html lang={locale}>` on root layout

**Files:**
- Modify: `landing/app/layout.tsx`
- Modify: `landing/app/[lang]/layout.tsx`

The root layout is shared across locales. We need `lang` to update on route change. Two approaches: (a) move `<html>` to per-locale layout, or (b) keep root `<html>` but use a client component to update `lang` attribute. Approach (a) is cleaner.

- [ ] **Step 1: Restructure layout to move `<html>` and `<body>` into `[lang]/layout.tsx`**

Read current `landing/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import './globals.css'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll - Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: `${BASE_PATH}/assets/icon-128.png`,
    apple: `${BASE_PATH}/assets/icon-128.png`,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.add(r);d.style.background=r==='dark'?'hsl(240,10%,3.9%)':'hsl(0,0%,100%)';d.style.color=r==='dark'?'hsl(0,0%,98%)':'hsl(240,10%,3.9%)';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <BackgroundDotGrid />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
```

Replace the file with this minimal root layout (no `<html>` tag, just metadata export):

```tsx
import type { Metadata } from 'next'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll - Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: `${BASE_PATH}/assets/icon-128.png`,
    apple: `${BASE_PATH}/assets/icon-128.png`,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

- [ ] **Step 2: Move `<html>` and `<body>` into per-locale layout**

Read current `landing/app/[lang]/layout.tsx`. Replace its return value to wrap children in `<html lang={locale}>` and `<body>`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Toaster } from 'sonner'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const loc = locale as Locale
  const dict = await getDictionary(loc)

  return {
    title: 'SmoothScroll - Natural Scroll Feel on Windows',
    description: dict.hero?.subtitle,
    alternates: {
      canonical: `/${loc}`,
      languages: {
        en: '/en',
        vi: '/vi',
        zh: '/zh',
        'zh-Hans': '/zh',
        'x-default': '/en',
      },
    },
    openGraph: {
      type: 'website',
      locale: loc === 'zh' ? 'zh_Hans' : loc,
      alternateLocale: loc === 'zh' ? ['en', 'vi'] : (loc === 'en' ? ['vi', 'zh'] : ['en']),
      images: [{ url: '/assets/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const loc = locale as Locale
  if (!locales.includes(loc)) notFound()

  const dict = await getDictionary(loc)

  return (
    <html lang={loc} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.add(r);d.style.background=r==='dark'?'hsl(240,10%,3.9%)':'hsl(0,0%,100%)';d.style.color=r==='dark'?'hsl(0,0%,98%)':'hsl(240,10%,3.9%)';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <BackgroundDotGrid />
        <Navigation
          locale={loc}
          langSwitcherDict={dict.langSwitcher ?? {}}
        />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer locale={loc} dict={{ footer: dict.footer ?? { tagline: '', links: { github: '', license: '' } } }} />
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success, no TS errors, all locale routes generated.

- [ ] **Step 4: Manually verify lang attribute**

Run: `cd D:/SmoothScroll/landing && pnpm start`
Open: `http://localhost:3000/en/` in DevTools → inspect `<html>` → `lang="en"`
Navigate to `/vi/` → inspect `<html>` → `lang="vi"`
Navigate to `/zh/` → inspect `<html>` → `lang="zh"`

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/layout.tsx landing/app/\[lang\]/layout.tsx
git commit -m "feat(a11y): set html lang attribute per locale"
```

---

## Task 1.2: Hero dark mode transition race fix

**Files:**
- Modify: `landing/components/sections/Hero.tsx`

The Hero H1, subtitle, and trust line can briefly show stale color when dark mode is toggled. Fix by adding `transition-colors duration-150` to text elements.

- [ ] **Step 1: Add transition classes to text elements**

In `landing/components/sections/Hero.tsx`, modify three text wrappers.

For the H1 element, change:

```tsx
<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch]">
```

to:

```tsx
<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150">
```

For the subtitle paragraph, change:

```tsx
<p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
```

to:

```tsx
<p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl transition-colors duration-150">
```

For the trust line paragraph, change:

```tsx
<p className="text-sm text-muted-foreground">{h.trustLine}</p>
```

to:

```tsx
<p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
```

- [ ] **Step 2: Verify visually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Click theme toggle → text color transitions smoothly, no flash to wrong color.

- [ ] **Step 3: Verify build still passes**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/Hero.tsx
git commit -m "fix(hero): add color transition for dark mode toggle"
```

---

## Task 1.3: Global reduced-motion CSS guard

**Files:**
- Modify: `landing/app/globals.css`

Add a `@media (prefers-reduced-motion: reduce)` block at the end of the file. This is a safety net for any third-party or future animations.

- [ ] **Step 1: Append reduced-motion block**

Append to `landing/app/globals.css` (after the existing `.brand-marquee-track` rule, line 100):

```css
@layer base {
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success, CSS bundle includes the rule.

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/globals.css
git commit -m "feat(a11y): add global prefers-reduced-motion guard"
```

---

## Task 1.4: Skip-to-content link

**Files:**
- Modify: `landing/components/Navigation.tsx`

Add a hidden skip-to-content link as the first focusable element.

- [ ] **Step 1: Add skip link element**

In `landing/components/Navigation.tsx`, the Navigation component returns a `<header>`. Add a sibling skip link before the `<header>`:

```tsx
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg"
      >
        Skip to content
      </a>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
          scrolled
            ? 'bg-background/80 backdrop-blur-md border-b shadow-sm py-2'
            : 'bg-transparent py-4'
        }`}
      >
        {/* ... existing header content ... */}
      </header>
    </>
  )
```

Wrap the return value in a fragment (`<>...</>`).

- [ ] **Step 2: Verify tab reveals link**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Press Tab once → skip-to-content link visible at top-left, Enter jumps to `<main id="main-content">`.

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/Navigation.tsx
git commit -m "feat(a11y): add skip-to-content link"
```

---

## Task 1.5: LangSwitcher touch support + ARIA menu pattern

**Files:**
- Modify: `landing/components/LangSwitcher.tsx`
- Create: `landing/components/LangSwitcher.test.tsx`

Convert from CSS `group-hover` to React state for touch devices. Add proper ARIA menu roles.

- [ ] **Step 1: Write the failing test**

Create `landing/components/LangSwitcher.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LangSwitcher } from './LangSwitcher'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/en/',
}))

describe('LangSwitcher', () => {
  it('renders trigger button with aria-expanded false initially', () => {
    render(<LangSwitcher locale="en" dict={{ langSwitcher: {} }} />)
    const trigger = screen.getByRole('button', { name: /current language/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens menu on click (touch-friendly)', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher locale="en" dict={{ langSwitcher: {} }} />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes menu on second click', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher locale="en" dict={{ langSwitcher: {} }} />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher locale="en" dict={{ langSwitcher: {} }} />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('menu items have role=menuitem', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher locale="en" dict={{ langSwitcher: {} }} />)
    await user.click(screen.getByRole('button', { name: /current language/i }))

    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(3) // en, vi, zh
  })
})
```

- [ ] **Step 2: Install Testing Library if missing**

Check `landing/package.json` for `@testing-library/react` and `@testing-library/user-event`. If missing:

Run: `cd D:/SmoothScroll/landing && pnpm add -D @testing-library/react @testing-library/user-event`

If already present, skip.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test LangSwitcher`
Expected: FAIL (component does not have `aria-expanded` or click handler yet).

- [ ] **Step 4: Rewrite LangSwitcher with state and ARIA**

Replace `landing/components/LangSwitcher.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import type { Locale } from '@/lib/i18n/dict'
import { FlagIcon } from './FlagIcon'

interface LangSwitcherProps {
  locale: Locale
  dict: {
    langSwitcher: Record<string, string>
  }
}

const localeLabels: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
}

const localeShort: Record<Locale, string> = {
  en: 'EN',
  vi: 'VI',
  zh: '中',
}

export function LangSwitcher({ locale }: LangSwitcherProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const switchLocale = (newLocale: Locale) => {
    if (!pathname) return
    const segments = pathname.split('/')
    segments[1] = newLocale
    return segments.join('/')
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Current language: ${localeLabels[locale]}. Click to switch language.`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline-flex">
          <FlagIcon lang={locale} />
        </span>
        <span>{localeShort[locale]}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Language selection"
          className="absolute right-0 mt-1 w-40 rounded-md border bg-popover py-1 shadow-md z-50"
        >
          {(Object.keys(localeLabels) as Locale[]).map((loc) => (
            <Link
              key={loc}
              href={switchLocale(loc) ?? '#'}
              role="menuitem"
              className={`flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                loc === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setOpen(false)}
              replace
            >
              <FlagIcon lang={loc} />
              <span>{localeLabels[loc]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test LangSwitcher`
Expected: PASS, all 5 tests green.

- [ ] **Step 6: Verify manual touch toggle**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
In DevTools, toggle device emulation (iPhone) → tap language button → menu opens.
Tap outside → menu closes.

- [ ] **Step 7: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/LangSwitcher.tsx landing/components/LangSwitcher.test.tsx
git commit -m "feat(a11y): convert LangSwitcher to click-toggle for touch + ARIA menu"
```

---

## Task 1.6: CopyButton aria-live region

**Files:**
- Modify: `landing/components/sections/Install.tsx`

- [ ] **Step 1: Add aria-live wrapper to CopyButton**

In `landing/components/sections/Install.tsx`, find the `CopyButton` function. Replace its return value:

```tsx
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify visually**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/#install`
Click copy button → icon changes to check. Enable VoiceOver/NVDA → should announce "Copied to clipboard".

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/Install.tsx
git commit -m "feat(a11y): announce copy state via aria-live region"
```

---

## Task 1.7: Disabled tab accessibility - replace title with aria-describedby

**Files:**
- Modify: `landing/components/sections/Install.tsx`
- Modify: `landing/components/ui/tabs.tsx`

- [ ] **Step 1: Add `aria-describedby` prop support to TabsTrigger**

Read `landing/components/ui/tabs.tsx` to find the TabsTrigger implementation. It uses Radix UI Tabs.Trigger under the hood. Add an optional `descriptionId` prop that sets `aria-describedby`:

In `landing/components/ui/tabs.tsx`, locate the TabsTrigger definition. Wrap with:

```tsx
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    descriptionId?: string
  }
>(({ className, descriptionId, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    aria-describedby={descriptionId}
    className={cn(/* existing classes */)}
    {...props}
  />
))
TabsTrigger.displayName = TabsTrigger.displayName || 'TabsTrigger'
```

(Keep all existing className logic. The change is purely adding the prop and forwarding `aria-describedby`.)

- [ ] **Step 2: Add Coming-soon description spans and wire them in Install.tsx**

In `landing/components/sections/Install.tsx`, add a unique id constant and update each disabled TabsTrigger. Replace the TabsList block:

```tsx
const LINUX_DESC_ID = 'linux-coming-soon-desc'
const MAC_DESC_ID = 'mac-coming-soon-desc'

<TabsList className="grid w-full grid-cols-3 mb-8">
  <TabsTrigger value="windows">{i.tabs?.windows?.label ?? 'Windows'}</TabsTrigger>
  <TabsTrigger
    value="linux"
    disabled
    descriptionId={LINUX_DESC_ID}
  >
    {i.tabs?.linux?.label ?? 'Linux'}
  </TabsTrigger>
  <TabsTrigger
    value="macos"
    disabled
    descriptionId={MAC_DESC_ID}
  >
    {i.tabs?.macos?.label ?? 'macOS'}
  </TabsTrigger>
</TabsList>
<span id={LINUX_DESC_ID} className="sr-only">
  Linux support is coming soon
</span>
<span id={MAC_DESC_ID} className="sr-only">
  macOS support is coming soon
</span>
```

(Remove the `title=` attributes from the disabled triggers - replaced by `descriptionId`.)

- [ ] **Step 3: Verify visually and with screen reader**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/#install`
Visual: Linux and macOS tabs still look disabled (greyed out).
VoiceOver/NVDA: focus Linux tab → announces "Linux, tab, dimmed, Linux support is coming soon".

- [ ] **Step 4: Run existing test suite**

Run: `cd D:/SmoothScroll/landing && pnpm test`
Expected: all tests pass (especially any tabs-related tests).

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/sections/Install.tsx landing/components/ui/tabs.tsx
git commit -m "feat(a11y): use aria-describedby for disabled tab tooltips"
```

---

## Task 1.8: Global focus outline

**Files:**
- Modify: `landing/app/globals.css`

- [ ] **Step 1: Append focus-visible rule**

Append to `landing/app/globals.css` (after the reduced-motion block):

```css
@layer base {
  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Remove default focus outline for mouse users, keep for keyboard */
  :focus:not(:focus-visible) {
    outline: none;
  }
}
```

- [ ] **Step 2: Verify tab reveals focus rings**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
Tab through page → every interactive element shows a 2px ring.
Click an element with mouse → no ring shown.

- [ ] **Step 3: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/globals.css
git commit -m "feat(a11y): add visible focus outline for keyboard nav"
```

---

## Task 1.9: Disabled text contrast (dark mode muted-foreground)

**Files:**
- Modify: `landing/app/globals.css`

Bump dark-mode `--muted-foreground` from `240 5% 64.9%` to `240 4% 70%` for ≥4.5:1 contrast on dark background.

- [ ] **Step 1: Update dark mode token**

In `landing/app/globals.css`, find the `.dark` block and change:

```css
--muted-foreground: 240 5% 64.9%;
```

to:

```css
--muted-foreground: 240 4% 70%;
```

- [ ] **Step 2: Verify disabled tab text is readable**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/#install`
Toggle dark mode → Linux and macOS disabled tabs: text clearly readable, contrast ≥4.5:1.

- [ ] **Step 3: Verify no other regressions in dark mode muted text**

Open: scroll to Stats / Features / Footer → muted text (timestamps, captions, secondary labels) still readable.

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/app/globals.css
git commit -m "fix(a11y): bump dark mode muted-foreground to AA contrast"
```

---

## Task 1.10: Distinct GitHub link labels (header vs footer)

**Files:**
- Modify: `landing/components/Navigation.tsx`
- Modify: `landing/components/Footer.tsx`

- [ ] **Step 1: Update header GitHub link**

In `landing/components/Navigation.tsx`, the GitHub link is the `<a>` wrapping the GitHub button. Add `aria-label`:

```tsx
<a
  href="https://github.com/quangtruong2003/SmoothScroll"
  target="_blank"
  rel="noopener noreferrer"
  className="hidden sm:flex"
  aria-label="SmoothScroll on GitHub (opens new tab)"
>
```

- [ ] **Step 2: Read Footer.tsx and update GitHub link there**

Read `landing/components/Footer.tsx`. Find the GitHub link. Replace its accessible name with a distinct label:

```tsx
<a
  href="https://github.com/quangtruong2003/SmoothScroll"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="SmoothScroll repository on GitHub (opens new tab)"
>
```

(Keep all other classes/structure.)

- [ ] **Step 3: Verify with screen reader**

Run: `cd D:/SmoothScroll/landing && pnpm dev`
Open: `http://localhost:3000/en/`
VoiceOver/NVDA: focus header GitHub → "SmoothScroll on GitHub, link, opens new tab". Focus footer GitHub → "SmoothScroll repository on GitHub, link, opens new tab". Two distinct labels.

- [ ] **Step 4: Commit**

```bash
cd D:/SmoothScroll
git add landing/components/Navigation.tsx landing/components/Footer.tsx
git commit -m "feat(a11y): distinct aria-labels for header and footer GitHub links"
```

---

## Sprint 1 Verification Gate

Run all checks before declaring Sprint 1 done:

- [ ] **Build green**

Run: `cd D:/SmoothScroll/landing && pnpm build`
Expected: success, no TS errors.

- [ ] **Unit tests green**

Run: `cd D:/SmoothScroll/landing && pnpm test`
Expected: all tests pass.

- [ ] **E2E a11y smoke check (Task 1.11 below)**

- [ ] **Manual pre-flight checklist**

Per spec Section 7:
- [ ] Hero text color transitions smoothly when toggling dark
- [ ] `<html lang>` reflects current locale
- [ ] Skip-to-content link appears on Tab
- [ ] LangSwitcher opens on tap (mobile emulation)
- [ ] Disabled tabs announce coming-soon via screen reader
- [ ] Copy button announces "Copied" via screen reader
- [ ] Focus ring visible on all interactive elements
- [ ] Disabled tab text ≥4.5:1 contrast in dark mode

---

## Task 1.11: E2E a11y smoke spec

**Files:**
- Create: `landing/e2e/a11y-audit.spec.ts`

This spec must run AFTER Tasks 1.1-1.10 land. It verifies all a11y fixes via axe-core and viewport assertions.

- [ ] **Step 1: Install axe-core devDep**

Run: `cd D:/SmoothScroll/landing && pnpm add -D @axe-core/playwright`

If installation fails, fallback: use `axe-core` directly injected into page (manual injection). Document in spec.

- [ ] **Step 2: Create a11y-audit.spec.ts**

Create `landing/e2e/a11y-audit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const LOCALES = ['en', 'vi', 'zh'] as const

test.describe('A11y audit smoke', () => {
  for (const locale of LOCALES) {
    test(`home page /${locale}/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test(`how-it-works page /${locale}/how-it-works/ has no critical a11y violations`, async ({ page }) => {
      await page.goto(`/${locale}/how-it-works/`)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })
  }

  test('html lang attribute matches locale', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/`)
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang).toBe(locale)
    }
  })
})
```

- [ ] **Step 3: Create mobile-no-overflow.spec.ts**

Create `landing/e2e/mobile-no-overflow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const PAGES = [
  '/en/',
  '/en/how-it-works/',
  '/vi/',
  '/zh/',
]

test.describe('Mobile no-horizontal-scroll', () => {
  for (const path of PAGES) {
    test(`mobile 390px ${path} has no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(path)

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
```

- [ ] **Step 4: Run e2e tests**

Run: `cd D:/SmoothScroll/landing && pnpm test:e2e`
Expected: all tests pass. If any a11y violation appears, fix the underlying bug in Tasks 1.1-1.10 before continuing.

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll
git add landing/e2e/a11y-audit.spec.ts landing/e2e/mobile-no-overflow.spec.ts landing/package.json pnpm-lock.yaml
git commit -m "test(e2e): add a11y audit smoke + mobile no-overflow specs"
```

---

## Sprint 1 Done Definition

- All 11 tasks (1.1-1.11) committed
- `pnpm build` green
- `pnpm test` green
- `pnpm test:e2e` green
- Manual pre-flight checklist ticked
- Spec Section 7 boxes ticked for Sprint 1 scope

Proceed to Sprint 2 plan after this gate.