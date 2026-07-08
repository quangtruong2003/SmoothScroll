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
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang as Locale
  const dict = await getDictionary(locale)

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SmoothScroll',
    operatingSystem: 'Windows',
    applicationCategory: 'UtilitiesApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: dict.hero?.subtitle ?? '',
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (dict.faq?.questions ?? []).map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareJsonLd, faqJsonLd]) }}
      />
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
    </>
  )
}
