'use client'

import Link from 'next/link'
import { DownloadCTA } from '@/components/DownloadCTA'
import { LogoWall } from '@/components/LogoWall'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { type Dictionary, type Locale } from '@/lib/i18n/dict'
import { localePath } from '@/lib/i18n/routing'


interface HeroProps {
  locale: Locale
  dict: { hero?: Dictionary['hero'] }
}

export function Hero({ locale, dict }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', eyebrowLinux: '', eyebrowMac: '', title: '', titleAccent: '', subtitle: '', cta: 'Download for Windows', ctaLinux: 'Download for Linux', ctaMac: 'Download for macOS', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }
  const { isMac, isLinux } = useDownloadUrl()
  const eyebrow = isMac ? h.eyebrowMac : isLinux ? h.eyebrowLinux : h.eyebrow

  return (
    <section data-hero-layout="editorial-split" className="min-h-[100dvh] flex items-center pt-28 pb-20 px-4">
      <div className="container">
        <div className="grid grid-cols-1 items-center">
          <div data-hero-copy className="mx-auto max-w-5xl flex flex-col items-center text-center gap-7">
            <p data-hero-eyebrow className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150">
              {eyebrow}
            </p>

            <h1 className="text-[clamp(3.5rem,7vw,7rem)] font-bold tracking-tight leading-[0.95] max-w-6xl transition-colors duration-150">
              {h.title}{' '}
              <span className="text-primary italic">{h.titleAccent}</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl transition-colors duration-150">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full">
              <div data-hero-cta>
                <DownloadCTA
                  label={h.cta ?? 'Download for Windows'}
                  labelLinux={h.ctaLinux}
                  labelMac={h.ctaMac}
                  variant="brand"
                  size="xl"
                  className="w-full sm:w-auto"
                />
              </div>
              <Link
                data-hero-cta
                data-hero-secondary-cta
                href={localePath(locale, 'how-it-works')}
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
            <div data-hero-social-proof className="w-full max-w-3xl">
              <LogoWall />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
