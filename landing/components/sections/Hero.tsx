'use client'

import Link from 'next/link'
import { DownloadCTA } from '@/components/DownloadCTA'
import { LogoWall } from '@/components/LogoWall'
import { Badge } from '@/components/ui/badge'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import type { Dictionary } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
  locale: string
}

export function Hero({ dict }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', eyebrowLinux: '', eyebrowMac: '', title: '', titleAccent: '', subtitle: '', cta: 'Download for Windows', ctaLinux: 'Download for Linux', ctaMac: 'Download for macOS', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }
  const { isMac, isLinux } = useDownloadUrl()
  const eyebrow = isMac ? h.eyebrowMac : isLinux ? h.eyebrowLinux : h.eyebrow

  return (
    <section className="min-h-[100dvh] flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150">
              {h.title}{' '}
              <span className="text-primary italic">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl transition-colors duration-150">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full">
              <DownloadCTA
                label={h.cta ?? 'Download for Windows'}
                labelLinux={h.ctaLinux}
                labelMac={h.ctaMac}
                variant="brand"
                size="xl"
                className="w-full sm:w-auto"
              />
              <Link
                href="/how-it-works/"
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
            <div className="w-full max-w-3xl mx-auto">
              <LogoWall />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
