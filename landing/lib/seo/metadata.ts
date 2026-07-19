import type { Metadata } from 'next'
import type { Dictionary, Locale } from '@/lib/i18n/dict'
import { absoluteLocaleUrl, localeAlternates, type PageKind } from '@/lib/i18n/routing'

const openGraphLocales: Record<Locale, 'en_US' | 'vi_VN' | 'zh_CN'> = {
  en: 'en_US',
  vi: 'vi_VN',
  zh: 'zh_CN',
}

export function buildMetadata(locale: Locale, page: PageKind, dictionary: Dictionary): Metadata {
  const isGuide = page === 'how-it-works'
  const title = isGuide
    ? dictionary.howItWorks?.seo?.title ?? 'How SmoothScroll Works'
    : dictionary.seo?.title ?? dictionary.hero?.title ?? 'SmoothScroll'
  const description = isGuide
    ? dictionary.howItWorks?.seo?.description ?? ''
    : dictionary.seo?.description ?? dictionary.hero?.subtitle ?? ''
  const url = absoluteLocaleUrl(locale, page)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: localeAlternates(page) },
    openGraph: {
      title,
      description,
      url,
      siteName: 'SmoothScroll',
      locale: openGraphLocales[locale],
      alternateLocale: Object.values(openGraphLocales).filter((value) => value !== openGraphLocales[locale]),
      type: 'website',
      images: [{ url: 'https://smoothscroll.top/assets/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['https://smoothscroll.top/assets/og-image.png'] },
  }
}
