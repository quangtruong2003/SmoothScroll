'use client'

import { JsonLd } from '@/app/JsonLd'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { Hero } from '@/components/sections/Hero'
import { PainPoints } from '@/components/sections/PainPoints'
import { ScrollDemo } from '@/components/sections/ScrollDemo'
import { SolutionBridge } from '@/components/sections/SolutionBridge'
import { Features } from '@/components/sections/Features'
import { TrayPreviewSection } from '@/components/sections/TrayPreviewSection'
import { Stats } from '@/components/sections/Stats'
import { Indie } from '@/components/sections/Indie'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { WhatIsSmoothScroll } from '@/components/sections/WhatIsSmoothScroll'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface LocalizedHomePageProps {
  locale: Locale
  dictionary: Dictionary
}

export function LocalizedHomePage({ locale, dictionary: d }: LocalizedHomePageProps) {
  return (
    <>
      <JsonLd locale={locale} page="home" dictionary={d} />
      <BackgroundDotGrid />
      <Navigation locale={locale} />
      <main id="main-content" className="flex-1">
        <Hero locale={locale} dict={{ hero: d.hero }} />
        <PainPoints dict={{ painPoints: d.painPoints }} />
        <ScrollDemo />
        <SolutionBridge dict={{ solutionBridge: d.solutionBridge }} />
        <Features dict={{ features: d.features }} />
        <TrayPreviewSection dict={{ trayPreview: d.trayPreview }} />
        <Stats dict={{ stats: d.stats }} />
        <Indie dict={{ indie: d.indie }} />
        <WhatIsSmoothScroll locale={locale} geo={d.geo} />
        <Install dict={{ install: d.install }} />
        <FAQ dict={{ faq: d.faq }} />
        <FinalCTA dict={{ finalCta: d.finalCta }} />
      </main>
      <Footer />
    </>
  )
}
