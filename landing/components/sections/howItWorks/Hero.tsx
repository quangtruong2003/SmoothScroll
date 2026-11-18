'use client'

import { Keyboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BackToHome } from '@/components/BackToHome'
import { DownloadCTA } from '@/components/DownloadCTA'
import { FadeUp } from '@/components/motion/FadeUp'
import { type Dictionary, type Locale } from '@/lib/i18n/dict'

interface HowItWorksHeroProps {
  locale: Locale
  hero: NonNullable<NonNullable<Dictionary['howItWorks']>['hero']>
}

export function HowItWorksHero({ locale, hero }: HowItWorksHeroProps) {
  return (
    <section className="relative pt-28 pb-12 px-4 overflow-hidden">
      <div className="container max-w-5xl">
        <BackToHome locale={locale} label={hero.backToHome ?? 'Back to home'} className="mb-8" />

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

          <FadeUp delay={0.2} className="w-full sm:w-auto">
            <div className="flex w-full sm:w-auto flex-col sm:flex-row items-center justify-center gap-3 mt-2">
              <DownloadCTA
                label={hero.ctaPrimary ?? 'Download'}
                variant="brand"
                size="xl"
                className="w-full sm:w-auto"
              />
              <a
                href="#shortcuts"
                className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center px-6 sm:px-7 text-sm sm:text-base font-medium rounded-md border border-border hover:bg-accent active:scale-[0.98] motion-safe:transition-[color,background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Keyboard className="h-4 w-4 mr-2 shrink-0" />
                {hero.ctaSecondary}
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
