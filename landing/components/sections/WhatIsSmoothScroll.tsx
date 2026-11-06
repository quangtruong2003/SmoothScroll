import Link from 'next/link'
import { localePath } from '@/lib/i18n/routing'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface WhatIsSmoothScrollProps {
  locale: Locale
  geo?: Dictionary['geo']
}

export function WhatIsSmoothScroll({ locale, geo }: WhatIsSmoothScrollProps) {
  if (!geo?.title || !geo.answer) return null

  return (
    <section aria-labelledby="what-is-smoothscroll" className="section-spacing px-4">
      <div className="container max-w-3xl">
        <h2 id="what-is-smoothscroll" className="text-3xl font-bold tracking-tight">{geo.title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{geo.answer}</p>
        <p className="mt-4 text-sm text-muted-foreground">{geo.evidence}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href={localePath(locale, 'how-it-works')} className="text-primary hover:underline">{geo.guideLabel}</Link>
          {' · '}
          <a href="https://github.com/quangtruong2003/SmoothScroll" className="text-primary hover:underline">{geo.sourceLabel}</a>
          {' · '}
          <a href="https://github.com/quangtruong2003/SmoothScroll/releases/latest" className="text-primary hover:underline">{geo.releaseLabel}</a>
        </p>
      </div>
    </section>
  )
}
