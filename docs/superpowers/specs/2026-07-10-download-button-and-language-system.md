# Design: Fix Download Button + Client-Side Language System

## Context

Two issues to address:

1. **Download button for macOS/Linux**: Currently disabled but missing "Coming Soon" badge
2. **Language system**: URL-based (`/en/`, `/vi/`, `/zh/`) → Change to localStorage-based (simpler URLs)

## Bug 1: Download Button - Add "Coming Soon" Badge

### Problem
`DownloadButtonWin.tsx` disables the button for macOS/Linux but doesn't show a badge indicating when support is coming.

### Solution
Add `comingSoonLabel` prop to `DownloadButtonWin` and render badge when disabled.

### Changes

**File: `landing/components/DownloadButtonWin.tsx`**

```tsx
interface DownloadButtonWinProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
  comingSoonLabel?: string  // NEW: e.g., "Coming Soon"
}

// When disabled, render badge:
{disabled && comingSoonLabel && (
  <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
    {comingSoonLabel}
  </span>
)}
```

**File: `landing/components/sections/Hero.tsx`**
- Pass `comingSoonLabel` from dict to `DownloadButtonWin`

**File: `landing/components/sections/Install.tsx`**
- Pass `comingSoonLabel` to `DownloadButtonWin`

**File: `landing/components/sections/howItWorks/Hero.tsx`**
- Pass `comingSoonLabel` from props

**File: `landing/components/sections/howItWorks/FinalCTA.tsx`**
- Pass `comingSoonLabel` from props

---

## Bug 2: Client-Side Language System

### Problem
URL-based routing (`/en/`, `/vi/`, `/zh/`) complicates deployment and requires redirects. For a simple static site, localStorage-based language is simpler.

### Solution
- Remove `[lang]` route segments
- Use React Context to manage language state
- Store preference in `localStorage`
- Detect browser language on first visit
- Components re-render when language changes

### Architecture

```
landing/
  app/
    layout.tsx              ← wraps with LanguageProvider
    page.tsx               ← / (homepage)
    how-it-works/
      page.tsx             ← /how-it-works
    not-found.tsx
  lib/
    i18n/
      context.tsx          ← LanguageContext + useLanguage hook
      provider.tsx         ← LanguageProvider component
```

### Files to Create

**`landing/lib/i18n/context.tsx`**

```tsx
'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { locales, type Locale } from './dict'

const STORAGE_KEY = 'smoothscroll-locale'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: Record<string, unknown> | null
  dictLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function detectInitialLocale(): Locale {
  // 1. Check localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale
    }
  }
  // 2. Check navigator.language
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('vi')) return 'vi'
  if (browserLang.startsWith('zh')) return 'zh'
  // 3. Default
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [dict, setDict] = useState<Record<string, unknown> | null>(null)
  const [dictLoading, setDictLoading] = useState(true)

  // Initialize on mount
  useEffect(() => {
    const initial = detectInitialLocale()
    setLocaleState(initial)
    loadDict(initial)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  async function loadDict(loc: Locale) {
    setDictLoading(true)
    try {
      const module = await import(`../dictionaries/${loc}.json`)
      setDict(module.default)
    } catch {
      // Fallback to English
      const module = await import('../dictionaries/en.json')
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

### Files to Modify

| File | Changes |
|------|---------|
| `app/layout.tsx` | Wrap with `LanguageProvider`, move dict loading to client |
| `app/page.tsx` | Use `useLanguage()` hook, remove `[lang]` param |
| `app/[lang]/page.tsx` | DELETE |
| `app/[lang]/how-it-works/page.tsx` | DELETE |
| `app/how-it-works/page.tsx` | Use `useLanguage()` hook |
| `components/Navigation.tsx` | Use `useLanguage()`, simplify links |
| `components/LangSwitcher.tsx` | Change from URL-based to localStorage-based |
| `components/Footer.tsx` | Remove locale prop, use context |
| `components/sections/*.tsx` | Use `useLanguage()` for locale |
| `lib/i18n/dict.ts` | Keep type definitions, remove localePrefix logic |
| `next.config.mjs` | May need adjustment for basePath |

### Data Flow

```
User visits site
    ↓
LanguageProvider mounts
    ↓
detectInitialLocale():
  1. localStorage['smoothscroll-locale'] → if exists, use it
  2. navigator.language → 'vi' or 'zh' → map to Locale
  3. Default: 'en'
    ↓
Load dict for detected locale
    ↓
Components read from context
    ↓
User clicks language switcher
    ↓
setLocale(newLocale) + localStorage.setItem()
    ↓
Components re-render with new locale
```

### SEO Considerations

- Default meta tags use English (acceptable for simple site)
- `<html lang="en">` - acceptable fallback
- Social sharing URLs become simpler: `/how-it-works` instead of `/en/how-it-works`

### Backwards Compatibility

- Old URLs (`/en/...`, `/vi/...`, `/zh/...`) will 404
- GitHub Pages: Can add redirect rules if needed
- localStorage key: `'smoothscroll-locale'`

---

## Implementation Order

1. Fix DownloadButtonWin badge (isolated, no dependencies)
2. Create LanguageContext and Provider
3. Update app/layout.tsx to use Provider
4. Update app/page.tsx to use hook
5. Update app/how-it-works/page.tsx to use hook
6. Update Navigation and LangSwitcher
7. Update section components
8. Delete `[lang]` directories
9. Test locally with `pnpm dev`
10. Build and deploy
