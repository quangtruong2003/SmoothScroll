'use client'

// import { DemoScroll } from '@/components/DemoScroll'
import { DownloadCTA } from '@/components/DownloadCTA'
import { BrandMarquee } from '@/components/BrandMarquee'
import { Badge } from '@/components/ui/badge'
import type { Dictionary } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
}

export function Hero({ dict }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', title: '', titleAccent: '', subtitle: '', cta: 'Download', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }

  return (
    <section className="min-h-screen flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">{h.eyebrow}</Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch]">
              {h.title}{' '}
              <span className="text-primary italic">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <DownloadCTA label={h.cta ?? 'Download'} variant="brand" size="xl" />
              <a href="#how-it-works" className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors">
                {h.seeHow}
              </a>
            </div>

            <p className="text-sm text-muted-foreground">{h.trustLine}</p>
            <div className="w-full max-w-xl">
              <BrandMarquee />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
