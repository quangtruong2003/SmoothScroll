'use client'

import Link from 'next/link'
import { DownloadCTA } from '@/components/DownloadCTA'
import { BetaNotice } from '@/components/BetaNotice'
import { BrandMarquee } from '@/components/BrandMarquee'
import { Badge } from '@/components/ui/badge'
import { detectOS } from '@/lib/os'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero']; beta?: Dictionary['beta'] }
  locale: Locale
}

export function Hero({ dict, locale }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', eyebrowMac: '', title: '', titleAccent: '', subtitle: '', cta: 'Download', ctaMac: 'Download Beta for macOS', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }
  const b = dict?.beta ?? { badge: 'BETA', notice: '', reportPrefix: '', reportLink: '' }

  const isMac = detectOS() === 'mac'
  const eyebrow = isMac && h.eyebrowMac ? h.eyebrowMac : h.eyebrow

  return (
    <section className="min-h-screen flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>

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
              <DownloadCTA
                label={h.cta ?? 'Download'}
                labelMac={h.ctaMac}
                betaBadge={b.badge ?? 'BETA'}
                variant="brand"
                size="xl"
              />
              <Link href={`/${locale}/how-it-works`} className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors">
                {h.seeHow}
              </Link>
            </div>

            <BetaNotice
              notice={b.notice ?? ''}
              reportPrefix={b.reportPrefix ?? ''}
              reportLink={b.reportLink ?? ''}
            />

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
