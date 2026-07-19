'use client'

import Link from 'next/link'
import { Globe } from 'lucide-react'
import { STORAGE_KEY, useLanguage, type Locale } from '@/lib/i18n/provider'
import { localePath, type PageKind } from '@/lib/i18n/routing'
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

interface LangSwitcherProps {
  pageKind: PageKind
}

export function LangSwitcher({ pageKind }: LangSwitcherProps) {
  const { locale } = useLanguage()

  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Current language: ${localeLabels[locale]}. Open language selection.`}
      >
        <Globe className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline-flex"><FlagIcon lang={locale} /></span>
        <span>{localeShort[locale]}</span>
      </summary>
      <ul aria-label="Language selection" className="absolute right-0 z-50 mt-1 w-40 rounded-md border bg-popover py-1 shadow-md">
        {(Object.keys(localeLabels) as Locale[]).map((loc) => (
          <li key={loc}>
            <Link
              href={localePath(loc, pageKind)}
              className={`flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent ${
                loc === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => localStorage.setItem(STORAGE_KEY, loc)}
            >
              <FlagIcon lang={loc} />
              <span>{localeLabels[loc]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
