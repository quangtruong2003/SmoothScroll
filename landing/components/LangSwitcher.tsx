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
