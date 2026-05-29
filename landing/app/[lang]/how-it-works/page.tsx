import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'
import { HowItWorksHero } from '@/components/sections/howItWorks/Hero'
import { DemoFrame } from '@/components/sections/howItWorks/DemoFrame'
import { BigPicture } from '@/components/sections/howItWorks/BigPicture'
import { TabSections } from '@/components/sections/howItWorks/TabSections'
import { ShortcutsTable } from '@/components/sections/howItWorks/ShortcutsTable'
import { TrayActions } from '@/components/sections/howItWorks/TrayActions'
import { Recipes } from '@/components/sections/howItWorks/Recipes'
import { Privacy } from '@/components/sections/howItWorks/Privacy'
import { FinalCTA } from '@/components/sections/howItWorks/FinalCTA'

export async function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = lang as Locale
  const dict = await getDictionary(locale)
  const seo = dict.howItWorks?.seo

  return {
    title: seo?.title ?? 'How SmoothScroll Works',
    description: seo?.description,
    alternates: {
      canonical: `/${locale}/how-it-works`,
      languages: {
        en: '/en/how-it-works',
        vi: '/vi/how-it-works',
        zh: '/zh/how-it-works',
        'zh-Hans': '/zh/how-it-works',
        'x-default': '/en/how-it-works',
      },
    },
    openGraph: {
      type: 'article',
      locale: locale === 'zh' ? 'zh_Hans' : locale,
      title: seo?.title,
      description: seo?.description,
      images: [{ url: '/assets/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang as Locale
  if (!locales.includes(locale)) notFound()

  const dict = await getDictionary(locale)
  const h = dict.howItWorks

  if (!h?.hero || !h?.demo || !h?.bigPicture || !h?.tabs || !h?.shortcuts || !h?.tray || !h?.recipes || !h?.privacy || !h?.finalCta) {
    notFound()
  }

  const sections = h.tabs.sections ?? []
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: h.seo?.title ?? 'How SmoothScroll Works',
    description: h.seo?.description ?? '',
    step: sections.map((section, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: section.label,
      text: section.intro,
      url: `https://quangtruong2003.github.io/SmoothScroll/${locale}/how-it-works#tab-${section.id}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <HowItWorksHero
        locale={locale}
        hero={h.hero}
        ctaMacLabel={dict.hero?.ctaMac}
        betaBadge={dict.beta?.badge}
        comingSoonLabel={dict.finalCta?.comingSoon}
      />
      <DemoFrame demo={h.demo} />
      <BigPicture bigPicture={h.bigPicture} />
      <TabSections tabs={h.tabs} />
      <ShortcutsTable shortcuts={h.shortcuts} />
      <TrayActions tray={h.tray} />
      <Recipes recipes={h.recipes} />
      <Privacy privacy={h.privacy} />
      <FinalCTA
        finalCta={h.finalCta}
        ctaMacLabel={dict.hero?.ctaMac}
        betaBadge={dict.beta?.badge}
        comingSoonLabel={dict.finalCta?.comingSoon}
      />
    </>
  )
}
