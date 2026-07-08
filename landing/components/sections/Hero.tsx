'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { DownloadButtonWin } from '@/components/DownloadButtonWin'
import { BrandMarquee } from '@/components/BrandMarquee'
import { Badge } from '@/components/ui/badge'
import { detectOS } from '@/lib/os'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
  locale: Locale
}

export function Hero({ dict, locale }: HeroProps) {
  const h = dict?.hero ?? { eyebrow: '', eyebrowLinux: '', eyebrowMac: '', title: '', titleAccent: '', subtitle: '', cta: 'Download for Windows', ctaLinux: 'Download for Linux', ctaMac: 'Download for macOS', trustLine: '', seeHow: '', demoPrompt: '', demoToast: '' }

  const [os, setOs] = useState<'win' | 'mac' | 'linux' | 'other'>('other')
  useEffect(() => {
    setOs(detectOS())
  }, [])

  const eyebrow =
    os === 'mac'
      ? h.eyebrowMac
      : os === 'linux'
        ? h.eyebrowLinux
        : h.eyebrow

  return (
    <section className="min-h-screen flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch] transition-colors duration-150">
              {h.title}{' '}
              <span className="text-primary italic">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl transition-colors duration-150">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <DownloadButtonWin label={h.cta ?? 'Download for Windows'} variant="brand" size="xl" />
              {os !== 'win' && (
                <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Best on Windows · Linux & macOS coming soon
                </span>
              )}
              <Link
                href={`/${locale}/how-it-works`}
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground transition-colors duration-150">{h.trustLine}</p>
            <div className="w-full max-w-xl">
              <BrandMarquee />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
