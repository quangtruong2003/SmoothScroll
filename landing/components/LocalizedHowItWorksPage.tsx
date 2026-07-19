'use client'

import { JsonLd } from '@/app/JsonLd'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { HowItWorksHero } from '@/components/sections/howItWorks/Hero'
import { DemoFrame } from '@/components/sections/howItWorks/DemoFrame'
import { BigPicture } from '@/components/sections/howItWorks/BigPicture'
import { TabSections } from '@/components/sections/howItWorks/TabSections'
import { ShortcutsTable } from '@/components/sections/howItWorks/ShortcutsTable'
import { TrayActions } from '@/components/sections/howItWorks/TrayActions'
import { Recipes } from '@/components/sections/howItWorks/Recipes'
import { Privacy } from '@/components/sections/howItWorks/Privacy'
import { FinalCTA } from '@/components/sections/howItWorks/FinalCTA'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface LocalizedHowItWorksPageProps {
  locale: Locale
  dictionary: Dictionary
}

export function LocalizedHowItWorksPage({ locale, dictionary: d }: LocalizedHowItWorksPageProps) {
  const h = d.howItWorks
  if (!h?.hero || !h.demo || !h.bigPicture || !h.tabs || !h.shortcuts || !h.tray || !h.recipes || !h.privacy || !h.finalCta) return null

  return (
    <>
      <JsonLd locale={locale} page="how-it-works" dictionary={d} />
      <Navigation locale={locale} pageKind="how-it-works" />
      <main id="main-content">
        <HowItWorksHero locale={locale} hero={h.hero} ctaLinuxLabel={d.hero?.ctaLinux} ctaMacLabel={d.hero?.ctaMac} betaBadge={d.beta?.badge} comingSoonLabel={d.finalCta?.comingSoon ?? 'Coming Soon'} />
        <DemoFrame demo={h.demo} />
        <BigPicture bigPicture={h.bigPicture} />
        <TabSections tabs={h.tabs} dict={d} />
        <ShortcutsTable shortcuts={h.shortcuts} />
        <TrayActions tray={h.tray} />
        <Recipes recipes={h.recipes} />
        <Privacy privacy={h.privacy} />
        <FinalCTA finalCta={h.finalCta} ctaLinuxLabel={d.hero?.ctaLinux} ctaMacLabel={d.hero?.ctaMac} betaBadge={d.beta?.badge} comingSoonLabel={d.finalCta?.comingSoon ?? 'Coming Soon'} />
      </main>
      <Footer />
    </>
  )
}
