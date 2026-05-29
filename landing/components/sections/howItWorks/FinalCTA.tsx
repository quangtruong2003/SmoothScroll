'use client'

import { DownloadCTA } from '@/components/DownloadCTA'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

interface FinalCTAProps {
  finalCta: NonNullable<NonNullable<Dictionary['howItWorks']>['finalCta']>
  ctaMacLabel?: string
  betaBadge?: string
  comingSoonLabel?: string
}

export function FinalCTA({ finalCta, ctaMacLabel, betaBadge, comingSoonLabel }: FinalCTAProps) {
  return (
    <section className="py-20 sm:py-28 px-4 border-t">
      <div className="container max-w-3xl text-center">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            {finalCta.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="mt-4 text-lg text-muted-foreground">
            {finalCta.subtitle}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="mt-8 inline-flex">
            <DownloadCTA
              label={finalCta.cta ?? 'Download'}
              labelMac={ctaMacLabel}
              betaBadge={betaBadge}
              comingSoonLabel={comingSoonLabel}
              variant="brand"
              size="xl"
            />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
