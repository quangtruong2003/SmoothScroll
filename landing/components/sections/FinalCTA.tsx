'use client'

import { DownloadButtonWin } from '@/components/DownloadButtonWin'
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
  }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <Separator className="mb-16" />
        <div className="text-center max-w-xl mx-auto space-y-6 bg-primary text-primary-foreground rounded-2xl p-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {f.title}
          </h2>
          <p className="text-lg text-background/80">{f.subtitle}</p>
          <DownloadButtonWin label={f.cta ?? 'Download for Windows'} variant="default" size="xl" />
          <p className="text-sm text-background/70">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}

