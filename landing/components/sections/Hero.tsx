'use client'

import Link from 'next/link'
import { DownloadCTA } from '@/components/DownloadCTA'
import { LogoWall } from '@/components/LogoWall'
import { HeroBackground3D } from '@/components/sections/HeroBackground3D'
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
    <section data-hero-layout="editorial-split" className="relative min-h-[100dvh] px-4">
      <div className="flex min-h-[100dvh] items-center overflow-hidden pt-28 pb-24">
        <HeroBackground3D />
        {/* keeps the copy legible over the ribbons and lands the section on the page background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_42%,hsl(var(--background)/0.72)_0%,hsl(var(--background)/0.35)_55%,hsl(var(--background)/0)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background" />
        <div className="container relative z-10">
          <div data-hero-copy className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-6 text-center">
            <p data-hero-eyebrow className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm transition-colors duration-150">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-foreground" />
              {eyebrow}
            </p>

            <h1 className="max-w-5xl text-balance text-[clamp(3.25rem,6.5vw,6.25rem)] font-bold leading-[0.98] tracking-tight transition-colors duration-150">
              {h.title}{' '}
              <span className="text-primary italic">{h.titleAccent}</span>
            </h1>

            <p className="max-w-[40rem] text-pretty text-lg leading-relaxed text-muted-foreground transition-colors duration-150 sm:text-xl">
              {h.subtitle}
            </p>

            <div className="mt-1 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
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
                className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-background/40 px-7 text-base font-medium backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
            <div data-hero-social-proof className="mt-2 w-full max-w-3xl">
              <LogoWall />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          data-hero-scroll-cue
          className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground motion-reduce:hidden"
        >
          <span className="flex h-[34px] w-[22px] justify-center rounded-xl border-[1.5px] border-muted-foreground/55 pt-1.5">
            <span className="h-[7px] w-[3px] animate-hero-wheel rounded-sm bg-foreground" />
          </span>
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.14em]">Scroll</span>
        </div>
      </div>
    </section>
  )
}
