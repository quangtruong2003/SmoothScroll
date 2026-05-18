import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

interface LangLayoutProps {
  children: React.ReactNode
  params: { lang: string }
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  const locale = params.lang as Locale
  const dict = await getDictionary(locale)

  return {
    title: 'SmoothScroll — Natural Scroll Feel on Windows',
    description: dict.hero?.subtitle,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        vi: '/vi',
        zh: '/zh',
        'zh-Hans': '/zh',
        'x-default': '/en',
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_Hans' : locale,
      alternateLocale: locale === 'zh' ? ['en', 'vi'] : (locale === 'en' ? ['vi', 'zh'] : ['en']),
      images: [{ url: '/assets/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const locale = params.lang as Locale
  if (!locales.includes(locale)) notFound()

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
    mainEntity: (dict.faq?.questions ?? []).map((q: { q: string; a: string }) => ({
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
      <Navigation
        locale={locale}
        langSwitcherDict={dict.langSwitcher ?? {}}
      />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer locale={locale} dict={{ footer: dict.footer ?? { tagline: '', links: { github: '', license: '' } } }} />
    </>
  )
}
