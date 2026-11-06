'use client'

import { DownloadCTA } from '@/components/DownloadCTA'
import type { Dictionary } from '@/lib/i18n/dict'

interface FinalCTAProps {
  dict: { finalCta?: Dictionary['finalCta'] }
}

export function FinalCTA({ dict }: FinalCTAProps) {
  const f = dict?.finalCta ?? {
    title: '',
    subtitle: '',
    cta: 'Download for Windows',
    ctaSub: '',
  }

  return (
    <section className="px-4 py-[clamp(4rem,6vw,5.5rem)]">
      <div className="container">
        <div data-final-cta className="mx-auto max-w-3xl space-y-6 rounded-[1.25rem] border border-border bg-gradient-to-b from-muted/40 to-transparent p-8 text-center text-card-foreground sm:px-12 sm:py-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {f.title}
          </h2>
          <p className="text-lg text-muted-foreground">{f.subtitle}</p>
          <DownloadCTA
            label={f.cta ?? 'Download'}
            variant="default"
            size="xl"
            className="w-full sm:w-auto"
          />
          <p className="text-sm text-muted-foreground">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}
