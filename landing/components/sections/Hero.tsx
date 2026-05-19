'use client'

import { DemoScroll } from '@/components/DemoScroll'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Badge } from '@/components/ui/badge'
import type { Dictionary } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
}

export function Hero({ dict }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', title: '', titleAccent: '', subtitle: '', cta: 'Download', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }

  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 px-4">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit">{h.eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {h.title}{' '}
              <span className="text-primary">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <DownloadCTA label={h.cta ?? 'Download'} variant="brand" size="xl" />
              <a href="#how-it-works" className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors">
                {h.seeHow}
              </a>
            </div>

            <p className="text-sm text-muted-foreground">{h.trustLine}</p>
          </div>

          <div>
            <DemoScroll prompt={h.demoPrompt ?? ''} toastMessage={h.demoToast ?? ''} />
          </div>
        </div>
      </div>
    </section>
  )
}
