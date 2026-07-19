'use client'

import { DownloadCTA } from '@/components/DownloadCTA'
import { Separator } from '@/components/ui/separator'
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
    ctaLinux: '',
    ctaMac: '',
  }

  return (
    <section className="px-4 pt-8 pb-32 md:pt-12 md:pb-48">
      <div className="container">
        <Separator className="mb-16" />
        <div data-final-cta className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-8 text-center text-card-foreground sm:p-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {f.title}
          </h2>
          <p className="text-lg text-muted-foreground">{f.subtitle}</p>
          <DownloadCTA
            label={f.cta ?? 'Download'}
            labelLinux={f.ctaLinux}
            labelMac={f.ctaMac}
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
