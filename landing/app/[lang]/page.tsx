import { Hero } from '@/components/sections/Hero'
import { PainPoints } from '@/components/sections/PainPoints'
import { SolutionBridge } from '@/components/sections/SolutionBridge'
import { Features } from '@/components/sections/Features'
import { UseCases } from '@/components/sections/UseCases'
import { TrayPreviewSection } from '@/components/sections/TrayPreviewSection'
import { Stats } from '@/components/sections/Stats'
import { Indie } from '@/components/sections/Indie'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang as Locale
  const dict = await getDictionary(locale)

  return (
    <>
      <Hero dict={{ hero: dict.hero, beta: dict.beta, finalCta: dict.finalCta }} locale={locale} />
      <PainPoints dict={{ painPoints: dict.painPoints }} />
      <SolutionBridge dict={{ solutionBridge: dict.solutionBridge }} />
      <Features dict={{ features: dict.features }} />
      <UseCases dict={{ useCases: dict.useCases }} />
      <TrayPreviewSection dict={{ trayPreview: dict.trayPreview }} />
      <Stats dict={{ stats: dict.stats }} />
      <Indie dict={{ indie: dict.indie }} />
      <Install dict={{ install: dict.install, beta: dict.beta }} />
      <FAQ dict={{ faq: dict.faq }} />
      <FinalCTA dict={{ finalCta: dict.finalCta, beta: dict.beta }} />
    </>
  )
}
