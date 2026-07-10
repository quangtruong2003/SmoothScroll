'use client'

import Link from 'next/link'
import { ArrowLeft, Keyboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DownloadCTA } from '@/components/DownloadCTA'
import { FadeUp } from '@/components/motion/FadeUp'
import { type Dictionary, type Locale } from '@/lib/i18n/dict'

interface HowItWorksHeroProps {
  locale: Locale
  hero: NonNullable<NonNullable<Dictionary['howItWorks']>['hero']>
  ctaLinuxLabel?: string
  ctaMacLabel?: string
  betaBadge?: string
  comingSoonLabel?: string
}

export function HowItWorksHero({ locale, hero, ctaLinuxLabel, ctaMacLabel, betaBadge, comingSoonLabel }: HowItWorksHeroProps) {
  return (
    <section className="relative pt-28 pb-12 px-4 overflow-hidden">
      <div className="container max-w-5xl">
        <FadeUp>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            {hero.backToHome}
          </Link>
        </FadeUp>

        <div className="flex flex-col items-center text-center gap-6">
          <FadeUp delay={0.05}>
            <Badge variant="secondary">{hero.eyebrow}</Badge>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {hero.title}{' '}
              <span className="text-primary italic">{hero.titleAccent}</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.15}>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {hero.subtitle}
            </p>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <DownloadCTA
                label={hero.ctaPrimary ?? 'Download'}
                labelLinux={ctaLinuxLabel}
                labelMac={ctaMacLabel}
                betaBadge={betaBadge}
                comingSoonLabel={comingSoonLabel}
                variant="brand"
                size="xl"
              />
              <a
                href="#shortcuts"
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                {hero.ctaSecondary}
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
