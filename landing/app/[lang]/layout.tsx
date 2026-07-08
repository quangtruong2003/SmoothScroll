import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

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

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang as Locale
  if (!locales.includes(locale)) notFound()

  const dict = await getDictionary(locale)

  return (
    <>
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
