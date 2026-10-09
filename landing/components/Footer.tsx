'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/provider'
import { localePath } from '@/lib/i18n/routing'
import type { Dictionary } from '@/lib/i18n/dict'

export function Footer() {
  const { dict, locale } = useLanguage()
  const d = dict as Dictionary | null
  const { footer: f } = d ?? {}

  // Windows-only product: every visitor sees the Windows tagline so crawlers
  // and mobile users never get a macOS/Linux promise we cannot keep.
  const tagline = f?.taglineWindows ?? f?.tagline ?? ''

  return (
    <footer className="mt-16 border-t px-4 py-8 sm:px-0">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{tagline}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href={localePath(locale, 'faq')}
            className="hover:text-foreground transition-colors"
          >
            {d?.faq?.title ?? 'FAQ'}
          </Link>          <Link
            href={localePath(locale, 'privacy')}
            className="hover:text-foreground transition-colors"
          >
            {f?.links?.privacy ?? 'Privacy'}
          </Link>          <Link
            href="https://github.com/quangtruong2003/SmoothScroll"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            aria-label="SmoothScroll repository on GitHub (opens new tab)"
          >
            {(f?.links?.github) ?? ''}
          </Link>
          <Link href="https://github.com/quangtruong2003/SmoothScroll/blob/master/LICENSE" className="hover:text-foreground transition-colors">
            {(f?.links?.license) ?? ''}
          </Link>
        </div>
      </div>
    </footer>
  )
}
