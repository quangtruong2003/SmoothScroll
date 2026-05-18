import { Hero } from '@/components/sections/Hero'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { StickyDownloadBar } from '@/components/StickyDownloadBar'
import { ExitIntentModal } from '@/components/ExitIntentModal'
import { getDictionary, type Locale } from '@/lib/i18n/dict'

interface PageProps {
  params: { lang: string }
}

export default async function LandingPage({ params }: PageProps) {
  const locale = params.lang as Locale
  const dict = await getDictionary(locale)

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <Hero dict={{ hero: dict.hero }} />
      <StickyDownloadBar
        ctaLabel={dict.hero?.cta ?? 'Download'}
        fallbackCta={dict.hero?.ctaFallback ?? 'Download'}
      />
      <ExitIntentModal
        dict={{
          title: dict.exitIntent?.title ?? '',
          message: dict.exitIntent?.message ?? '',
          cta: dict.exitIntent?.cta ?? '',
        }}
      />
      <Install dict={{ install: dict.install }} />
      <FAQ dict={{ faq: dict.faq }} />
      <FinalCTA dict={{ finalCta: dict.finalCta }} />
    </>
  )
}
