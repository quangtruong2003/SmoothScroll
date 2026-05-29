'use client'

import { DownloadCTA } from '@/components/DownloadCTA'
import { BetaNotice } from '@/components/BetaNotice'
import { Separator } from '@/components/ui/separator'
import type { Dictionary } from '@/lib/i18n/dict'

interface FinalCTAProps {
  dict: { finalCta?: Dictionary['finalCta']; beta?: Dictionary['beta'] }
}

export function FinalCTA({ dict }: FinalCTAProps) {
  const f = dict?.finalCta ?? { title: '', description: '', cta: '', ctaMac: '', ctaSub: '', comingSoon: 'Coming Soon' }
  const b = dict?.beta ?? { badge: 'BETA', notice: '', reportPrefix: '', reportLink: '' }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <Separator className="mb-16" />
        <div className="text-center max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{f.title}</h2>
          <p className="text-lg text-muted-foreground">{f.description}</p>
          <DownloadCTA
            label={f.cta ?? 'Download'}
            labelMac={f.ctaMac}
            betaBadge={b.badge ?? 'BETA'}
            comingSoonLabel={f.comingSoon ?? 'Coming Soon'}
            variant="brand"
            size="xl"
          />
          <BetaNotice
            notice={b.notice ?? ''}
            reportPrefix={b.reportPrefix ?? ''}
            reportLink={b.reportLink ?? ''}
          />
          <p className="text-sm text-muted-foreground max-w-none">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}

