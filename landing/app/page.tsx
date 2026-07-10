import { getDictionary } from '@/lib/i18n/dict'
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
import './globals.css'

export default async function RootPage() {
  const dict = await getDictionary('en')
  const locale = 'en'

  return (
    <>
      <BackgroundDotGrid />
      <Navigation locale={locale} langSwitcherDict={dict.langSwitcher} />
      <main id="main-content" className="flex-1">
        <Hero dict={{ hero: dict.hero }} locale={locale} />
        <PainPoints dict={{ painPoints: dict.painPoints }} />
        <ScrollDemo />
        <SolutionBridge dict={{ solutionBridge: dict.solutionBridge }} />
        <Features dict={{ features: dict.features }} />
        <TrayPreviewSection dict={{ trayPreview: dict.trayPreview }} />
        <Stats dict={{ stats: dict.stats }} />
        <Indie dict={{ indie: dict.indie }} />
        <Install dict={{ install: dict.install }} />
        <FAQ dict={{ faq: dict.faq }} />
        <FinalCTA dict={{ finalCta: dict.finalCta }} />
      </main>
      <Footer dict={{ footer: dict.footer }} locale={locale} />
    </>
  )
}
