# Download Button Badge + Client-Side Language System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Coming Soon" badge to disabled download buttons for macOS/Linux, and change language system from URL-based to localStorage-based.

**Architecture:** Two independent changes: (1) Add badge to existing disabled button pattern, (2) Replace `[lang]` route segments with React Context and localStorage persistence.

**Tech Stack:** Next.js App Router, React Context, localStorage

---

## File Structure

```
landing/
  components/
    DownloadButtonWin.tsx    # MODIFY: add comingSoonLabel prop + badge
    sections/
      Hero.tsx              # MODIFY: pass comingSoonLabel
      Install.tsx           # MODIFY: pass comingSoonLabel
      howItWorks/
        Hero.tsx            # MODIFY: pass comingSoonLabel
        FinalCTA.tsx        # MODIFY: pass comingSoonLabel
  lib/
    i18n/
      context.tsx            # CREATE: LanguageContext + useLanguage hook
      provider.tsx          # CREATE: LanguageProvider component
  app/
    layout.tsx              # MODIFY: wrap with LanguageProvider
    page.tsx                # MODIFY: use useLanguage hook
    how-it-works/
      page.tsx              # CREATE: from [lang]/how-it-works/page.tsx
    [lang]/                 # DELETE: entire directory
```

---

## Part 1: Download Button Badge

### Task 1: Add Coming Soon badge to DownloadButtonWin

**Files:**
- Modify: `landing/components/DownloadButtonWin.tsx`

- [ ] **Step 1: Read current file**

```tsx
// Current state - disabled shows just the label
{disabled ? (
  <span className="cursor-not-allowed">
    <Download className="h-5 w-5 mr-2" />
    {label}
  </span>
) : (
```

- [ ] **Step 2: Add comingSoonLabel prop to interface**

```tsx
interface DownloadButtonWinProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
  comingSoonLabel?: string  // ADD THIS
}
```

- [ ] **Step 3: Update destructuring**

```tsx
export function DownloadButtonWin({
  label,
  variant = 'brand',
  size = 'xl',
  className,
  disabled = false,
  comingSoonLabel,  // ADD THIS
}: DownloadButtonWinProps) {
```

- [ ] **Step 4: Add badge in disabled span**

```tsx
{disabled ? (
  <span className="cursor-not-allowed">
    <Download className="h-5 w-5 mr-2" />
    {label}
    {comingSoonLabel && (
      <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
        {comingSoonLabel}
      </span>
    )}
  </span>
) : (
```

- [ ] **Step 5: Commit**

```bash
git add landing/components/DownloadButtonWin.tsx
git commit -m "feat(landing): add comingSoonLabel badge to DownloadButtonWin"
```

---

### Task 2: Update Hero section to pass comingSoonLabel

**Files:**
- Modify: `landing/components/sections/Hero.tsx`

- [ ] **Step 1: Read current usage of DownloadButtonWin**

Current code (around line 50-62):
```tsx
<DownloadButtonWin
  label={
    os === 'mac'
      ? (h.ctaMac ?? 'Download for macOS') + ' (Beta)'
      : os === 'linux'
        ? (h.ctaLinux ?? 'Download for Linux') + ' (Beta)'
        : (h.cta ?? 'Download for Windows')
  }
  variant="brand"
  size="xl"
  className="w-full sm:w-auto"
  disabled={os === 'mac' || os === 'linux'}
/>
```

- [ ] **Step 2: Add comingSoonLabel prop**

Add after the `disabled` prop:
```tsx
<DownloadButtonWin
  label={
    os === 'mac'
      ? (h.ctaMac ?? 'Download for macOS') + ' (Beta)'
      : os === 'linux'
        ? (h.ctaLinux ?? 'Download for Linux') + ' (Beta)'
        : (h.cta ?? 'Download for Windows')
  }
  variant="brand"
  size="xl"
  className="w-full sm:w-auto"
  disabled={os === 'mac' || os === 'linux'}
  comingSoonLabel="Coming Soon"
/>
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/Hero.tsx
git commit -m "feat(landing): pass comingSoonLabel to DownloadButtonWin in Hero"
```

---

### Task 3: Update Install section to pass comingSoonLabel

**Files:**
- Modify: `landing/components/sections/Install.tsx`

- [ ] **Step 1: Read current DownloadButtonWin usage**

Current code (around line 143):
```tsx
<DownloadButtonWin label={i.cta ?? 'Download for Windows'} variant="brand" size="xl" className="w-full max-w-md" />
```

- [ ] **Step 2: Add comingSoonLabel prop**

```tsx
<DownloadButtonWin
  label={i.cta ?? 'Download for Windows'}
  variant="brand"
  size="xl"
  className="w-full max-w-md"
  disabled={false}
  comingSoonLabel="Coming Soon"
/>
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/Install.tsx
git commit -m "feat(landing): pass comingSoonLabel to DownloadButtonWin in Install"
```

---

### Task 4: Update howItWorks Hero section

**Files:**
- Modify: `landing/components/sections/howItWorks/Hero.tsx`

- [ ] **Step 1: Read current file**

```bash
cat landing/components/sections/howItWorks/Hero.tsx
```

- [ ] **Step 2: Find DownloadButtonWin usage and add comingSoonLabel**

```tsx
<DownloadButtonWin
  label={h.ctaPrimary ?? 'Download SmoothScroll'}
  variant="brand"
  size="xl"
  comingSoonLabel={comingSoonLabel}
/>
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/howItWorks/Hero.tsx
git commit -m "feat(landing): pass comingSoonLabel to howItWorks Hero"
```

---

### Task 5: Update howItWorks FinalCTA section

**Files:**
- Modify: `landing/components/sections/howItWorks/FinalCTA.tsx`

- [ ] **Step 1: Read current file**

```bash
cat landing/components/sections/howItWorks/FinalCTA.tsx
```

- [ ] **Step 2: Find DownloadButtonWin usage and add comingSoonLabel**

```tsx
<DownloadButtonWin
  label={f.cta ?? 'Download SmoothScroll'}
  variant="brand"
  size="xl"
  comingSoonLabel={comingSoonLabel}
/>
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/howItWorks/FinalCTA.tsx
git commit -m "feat(landing): pass comingSoonLabel to howItWorks FinalCTA"
```

---

## Part 2: Client-Side Language System

### Task 6: Create LanguageContext and Provider

**Files:**
- Create: `landing/lib/i18n/context.tsx`
- Create: `landing/lib/i18n/provider.tsx`

- [ ] **Step 1: Create context.tsx**

```tsx
'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Locale = 'en' | 'vi' | 'zh'

export const locales: Locale[] = ['en', 'vi', 'zh']
export const defaultLocale: Locale = 'en'
export const STORAGE_KEY = 'smoothscroll-locale'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: Record<string, unknown> | null
  dictLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function detectInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale
    }
  }
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('vi')) return 'vi'
  if (browserLang.startsWith('zh')) return 'zh'
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [dict, setDict] = useState<Record<string, unknown> | null>(null)
  const [dictLoading, setDictLoading] = useState(true)

  useEffect(() => {
    const initial = detectInitialLocale()
    setLocaleState(initial)
    loadDict(initial)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  async function loadDict(loc: Locale) {
    setDictLoading(true)
    try {
      const module = await import(`../../dictionaries/${loc}.json`)
      setDict(module.default)
    } catch {
      const module = await import('../../dictionaries/en.json')
      setDict(module.default)
    }
    setDictLoading(false)
  }

  function setLocale(loc: Locale) {
    setLocaleState(loc)
    loadDict(loc)
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dict, dictLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
```

- [ ] **Step 2: Create provider.tsx**

```tsx
'use client'

export { LanguageProvider, useLanguage, type Locale, locales, defaultLocale, STORAGE_KEY } from './context'
```

- [ ] **Step 3: Move dictionary JSON files**

Move from `landing/lib/i18n/` to `landing/dictionaries/`:
```bash
mv landing/lib/i18n/en.json landing/dictionaries/
mv landing/lib/i18n/vi.json landing/dictionaries/
mv landing/lib/i18n/zh.json landing/dictionaries/
```

- [ ] **Step 4: Commit**

```bash
git add landing/lib/i18n/
git add landing/dictionaries/
git commit -m "feat(landing): add LanguageContext and Provider for client-side i18n"
```

---

### Task 7: Update app/layout.tsx

**Files:**
- Modify: `landing/app/layout.tsx`

- [ ] **Step 1: Read current layout**

```bash
cat landing/app/layout.tsx
```

- [ ] **Step 2: Update to use LanguageProvider**

```tsx
import type { Metadata } from 'next'
import { LanguageProvider } from '@/lib/i18n/provider'
import './globals.css'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  metadataBase: new URL('https://smoothscroll.top'),
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Add globals.css import if missing**

The layout already imports './globals.css' - verify it's there.

- [ ] **Step 4: Commit**

```bash
git add landing/app/layout.tsx
git commit -m "feat(landing): wrap app with LanguageProvider in layout"
```

---

### Task 8: Update app/page.tsx (homepage)

**Files:**
- Modify: `landing/app/page.tsx`

- [ ] **Step 1: Read current page**

```bash
cat landing/app/page.tsx
```

- [ ] **Step 2: Update to use useLanguage hook**

```tsx
'use client'

import { useLanguage } from '@/lib/i18n/provider'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { Hero } from '@/components/sections/Hero'
import { PainPoints } from '@/components/sections/PainPoints'
import { ScrollDemo } from '@/components/sections/ScrollDemo'
import { SolutionBridge } from '@/components/sections/SolutionBridge'
import { Features } from '@/components/sections/Features'
import { TrayPreviewSection } from '@/components/sections/TrayPreviewSection'
import { Stats } from '@/components/sections/Stats'
import { Indie } from '@/components/sections/Indie'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import type { Dictionary } from '@/lib/i18n/dict'

export default function HomePage() {
  const { locale, dict } = useLanguage()
  const d = dict as Dictionary | null

  return (
    <>
      <BackgroundDotGrid />
      <Navigation locale={locale} dict={d} />
      <main id="main-content" className="flex-1">
        <Hero dict={{ hero: d?.hero }} locale={locale} />
        <PainPoints dict={{ painPoints: d?.painPoints }} />
        <ScrollDemo />
        <SolutionBridge dict={{ solutionBridge: d?.solutionBridge }} />
        <Features dict={{ features: d?.features }} />
        <TrayPreviewSection dict={{ trayPreview: d?.trayPreview }} />
        <Stats dict={{ stats: d?.stats }} />
        <Indie dict={{ indie: d?.indie }} />
        <Install dict={{ install: d?.install }} />
        <FAQ dict={{ faq: d?.faq }} />
        <FinalCTA dict={{ finalCta: d?.finalCta }} />
      </main>
      <Footer dict={{ footer: d?.footer }} locale={locale} />
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/app/page.tsx
git commit -m "feat(landing): use useLanguage hook in homepage"
```

---

### Task 9: Create app/how-it-works/page.tsx

**Files:**
- Create: `landing/app/how-it-works/page.tsx`
- Reference: `landing/app/[lang]/how-it-works/page.tsx`

- [ ] **Step 1: Read the [lang] version**

```bash
cat landing/app/\[lang\]/how-it-works/page.tsx
```

- [ ] **Step 2: Create simplified version**

```tsx
'use client'

import { useLanguage } from '@/lib/i18n/provider'
import { HowItWorksHero } from '@/components/sections/howItWorks/Hero'
import { DemoFrame } from '@/components/sections/howItWorks/DemoFrame'
import { BigPicture } from '@/components/sections/howItWorks/BigPicture'
import { TabSections } from '@/components/sections/howItWorks/TabSections'
import { ShortcutsTable } from '@/components/sections/howItWorks/ShortcutsTable'
import { TrayActions } from '@/components/sections/howItWorks/TrayActions'
import { Recipes } from '@/components/sections/howItWorks/Recipes'
import { Privacy } from '@/components/sections/howItWorks/Privacy'
import { FinalCTA } from '@/components/sections/howItWorks/FinalCTA'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function HowItWorksPage() {
  const { locale, dict } = useLanguage()
  const d = dict as Dictionary | null
  const h = d?.howItWorks

  if (!h?.hero || !h?.demo || !h?.bigPicture || !h?.tabs || !h?.shortcuts || !h?.tray || !h?.recipes || !h?.privacy || !h?.finalCta) {
    return null
  }

  const sections = h.tabs.sections ?? []

  return (
    <>
      <HowItWorksHero
        locale={locale}
        hero={h.hero}
        ctaLinuxLabel={d?.hero?.ctaLinux}
        ctaMacLabel={d?.hero?.ctaMac}
        betaBadge={d?.beta?.badge}
        comingSoonLabel={h.finalCta?.comingSoon ?? 'Coming Soon'}
      />
      <DemoFrame demo={h.demo} />
      <BigPicture bigPicture={h.bigPicture} />
      <TabSections tabs={h.tabs} dict={d} />
      <ShortcutsTable shortcuts={h.shortcuts} />
      <TrayActions tray={h.tray} />
      <Recipes recipes={h.recipes} />
      <Privacy privacy={h.privacy} />
      <FinalCTA
        finalCta={h.finalCta}
        ctaLinuxLabel={d?.hero?.ctaLinux}
        ctaMacLabel={d?.hero?.ctaMac}
        betaBadge={d?.beta?.badge}
        comingSoonLabel={h.finalCta?.comingSoon ?? 'Coming Soon'}
      />
    </>
  )
}

export function generateMetadata() {
  return {
    title: 'How SmoothScroll Works',
    description: 'Learn how SmoothScroll makes scrolling on Windows feel natural and smooth.',
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/app/how-it-works/page.tsx
git commit -m "feat(landing): create how-it-works page with useLanguage hook"
```

---

### Task 10: Update Navigation component

**Files:**
- Modify: `landing/components/Navigation.tsx`

- [ ] **Step 1: Read current Navigation**

```bash
cat landing/components/Navigation.tsx
```

- [ ] **Step 2: Update to use useLanguage**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Github } from 'lucide-react'
import { ScrollToTop } from './ScrollToTop'
import { Button } from '@/components/ui/button'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useGitHubStars } from '@/lib/useGitHubStars'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface NavigationProps {
  locale: string
  dict?: Dictionary | null
}

export function Navigation({ locale, dict }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const stars = useGitHubStars()
  const { locale: contextLocale } = useLanguage()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
        <nav className="container flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Image
              src={`${BASE_PATH}/assets/icon-128.png`}
              alt="SmoothScroll logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="hidden sm:inline">SmoothScroll</span>
          </Link>

          <div className="flex items-center gap-2">
            {stars !== null && (
              <a
                href="https://github.com/quangtruong2003/SmoothScroll"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden xl:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Star className="h-4 w-4" />
                <span>{stars.toLocaleString()}</span>
              </a>
            )}
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
            <LangSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <ScrollToTop />
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/Navigation.tsx
git commit -m "feat(landing): use useLanguage in Navigation"
```

---

### Task 11: Update LangSwitcher component

**Files:**
- Modify: `landing/components/LangSwitcher.tsx`

- [ ] **Step 1: Read current LangSwitcher**

```bash
cat landing/components/LangSwitcher.tsx
```

- [ ] **Step 2: Replace with localStorage-based version**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage, type Locale } from '@/lib/i18n/provider'
import { FlagIcon } from './FlagIcon'

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

export function LangSwitcher() {
  const { locale, setLocale } = useLanguage()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

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
            <button
              key={loc}
              type="button"
              role="menuitem"
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                loc === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setLocale(loc)
                setOpen(false)
              }}
            >
              <FlagIcon lang={loc} />
              <span>{localeLabels[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/LangSwitcher.tsx
git commit -m "feat(landing): convert LangSwitcher to localStorage-based"
```

---

### Task 12: Update Footer component

**Files:**
- Modify: `landing/components/Footer.tsx`

- [ ] **Step 1: Read current Footer**

```bash
cat landing/components/Footer.tsx
```

- [ ] **Step 2: Simplify (remove locale prop dependency)**

```tsx
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

export function Footer() {
  const { dict } = useLanguage()
  const d = dict as Dictionary | null
  const { footer: f = { tagline: '', links: { github: '', license: '' } } } = d ?? {}

  return (
    <footer className="border-t py-8 pb-8 sm:pb-8 mt-16">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{f.tagline ?? ''}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="https://github.com/quangtruong2003/SmoothScroll"
            className="hover:text-foreground transition-colors"
            aria-label="SmoothScroll repository on GitHub (opens new tab)"
          >
            {f.links?.github ?? ''}
          </Link>
          <Link href="https://github.com/quangtruong2003/SmoothScroll/blob/main/LICENSE" className="hover:text-foreground transition-colors">
            {f.links?.license ?? ''}
          </Link>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/Footer.tsx
git commit -m "feat(landing): simplify Footer to use useLanguage"
```

---

### Task 13: Delete [lang] directories

**Files:**
- Delete: `landing/app/[lang]/`

- [ ] **Step 1: Verify no other references to [lang] route**

```bash
grep -r "\[lang\]" landing/app/ --include="*.tsx" --include="*.ts"
```

- [ ] **Step 2: Delete the directory**

```bash
rm -rf landing/app/\[lang\]
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(landing): remove [lang] route segments, use client-side i18n"
```

---

### Task 14: Update section components to use useLanguage

**Files:**
- Modify: Various section components that need dict

- [ ] **Step 1: Update Hero.tsx**

```tsx
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DownloadButtonWin } from '@/components/DownloadButtonWin'
import { LogoWall } from '@/components/LogoWall'
import { Badge } from '@/components/ui/badge'
import { detectOS } from '@/lib/os'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
  locale: string
}

export function Hero({ dict, locale }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', eyebrowLinux: '', eyebrowMac: '', title: '', titleAccent: '', subtitle: '', cta: 'Download for Windows', ctaLinux: 'Download for Linux', ctaMac: 'Download for macOS', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }

  const [os, setOs] = useState<'win' | 'mac' | 'linux' | 'other'>('other')
  useEffect(() => {
    setOs(detectOS())
  }, [])

  const eyebrow =
    os === 'mac'
      ? h.eyebrowMac
      : os === 'linux'
        ? h.eyebrowLinux
        : h.eyebrow

  return (
    <section className="min-h-[100dvh] flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150">
              {h.title}{' '}
              <span className="text-primary italic">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl transition-colors duration-150">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full">
              <DownloadButtonWin
                label={
                  os === 'mac'
                    ? (h.ctaMac ?? 'Download for macOS') + ' (Beta)'
                    : os === 'linux'
                      ? (h.ctaLinux ?? 'Download for Linux') + ' (Beta)'
                      : (h.cta ?? 'Download for Windows')
                }
                variant="brand"
                size="xl"
                className="w-full sm:w-auto"
                disabled={os === 'mac' || os === 'linux'}
                comingSoonLabel="Coming Soon"
              />
              <Link
                href="/how-it-works/"
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
            <div className="w-full max-w-3xl mx-auto">
              <LogoWall />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

Note: Hero now uses Link with `/how-it-works/` instead of `localePath`.

- [ ] **Step 2: Update other sections as needed**

Check each section component - some may need minor updates to use simplified dict structure.

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/Hero.tsx
git commit -m "feat(landing): update Hero section for new i18n"
```

---

### Task 15: Test and build

- [ ] **Step 1: Run dev server**

```bash
cd landing && pnpm dev
```

- [ ] **Step 2: Test language switching**

Open browser, check:
- Default language matches browser
- Switching language updates all text
- localStorage is set correctly

- [ ] **Step 3: Test download button**

On macOS/Linux: Button disabled with "Coming Soon" badge
On Windows: Button works normally

- [ ] **Step 4: Build for production**

```bash
cd landing && pnpm build
```

- [ ] **Step 5: Verify no errors**

Expected: Successful build with no TypeScript errors.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat(landing): complete client-side i18n implementation"
```

---

## Verification Checklist

- [ ] Download button shows "Coming Soon" badge on macOS/Linux
- [ ] Download button works normally on Windows
- [ ] Language switcher changes language without page reload
- [ ] Language persists in localStorage across sessions
- [ ] Browser language is detected on first visit
- [ ] All routes work: `/`, `/how-it-works/`
- [ ] No 404s for `[lang]` routes
- [ ] Production build succeeds
- [ ] All existing functionality preserved
