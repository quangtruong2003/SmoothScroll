'use client'

import { useLanguage } from '@/lib/i18n/provider'
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
import type { Dictionary } from '@/lib/i18n/dict'

export default function HomePage() {
  const { locale, dict } = useLanguage()
  const d = dict as Dictionary | null

  return (
    <>
      <BackgroundDotGrid />
      <Navigation locale={locale} dict={d} />
      <main id="main-content" className="flex-1">
        <Hero dict={{ hero: d?.hero }} locale={locale} />
        <PainPoints dict={{ painPoints: d?.painPoints }} />
        <ScrollDemo />
        <SolutionBridge dict={{ solutionBridge: d?.solutionBridge }} />
        <Features dict={{ features: d?.features }} />
        <TrayPreviewSection dict={{ trayPreview: d?.trayPreview }} />
        <Stats dict={{ stats: d?.stats }} />
        <Indie dict={{ indie: d?.indie }} />
        <Install dict={{ install: d?.install }} />
        <FAQ dict={{ faq: d?.faq }} />
        <FinalCTA dict={{ finalCta: d?.finalCta }} />
      </main>
      <Footer />
    </>
  )
}
