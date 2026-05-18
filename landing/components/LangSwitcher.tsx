'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

  const switchLocale = (newLocale: Locale) => {
    if (!pathname) return
    const segments = pathname.split('/')
    segments[1] = newLocale
    return segments.join('/')
  }

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Current language: ${localeLabels[locale]}. Click to switch language.`}
        aria-haspopup="menu"
      >
        <Globe className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline-flex">
          <FlagIcon lang={locale} />
        </span>
        <span>{localeShort[locale]}</span>
      </button>
      <div className="absolute right-0 mt-1 w-40 rounded-md border bg-popover py-1 shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
        {(Object.keys(localeLabels) as Locale[]).map((loc) => (
          <Link
            key={loc}
            href={switchLocale(loc) ?? '#'}
            className={`flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
              loc === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
            replace
          >
            <FlagIcon lang={loc} />
            <span>{localeLabels[loc]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
