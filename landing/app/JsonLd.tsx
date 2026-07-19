import type { Dictionary, Locale } from '@/lib/i18n/dict'
import { BASE_URL, absoluteLocaleUrl, htmlLang, type PageKind } from '@/lib/i18n/routing'

interface JsonLdProps {
  locale: Locale
  page: PageKind
  dictionary: Dictionary
}

export function JsonLd({ locale, page, dictionary }: JsonLdProps) {
  const url = absoluteLocaleUrl(locale, page)
  const title = page === 'home'
    ? dictionary.seo?.title ?? dictionary.hero?.title ?? 'SmoothScroll'
    : dictionary.howItWorks?.seo?.title ?? 'How SmoothScroll Works'
  const description = page === 'home'
    ? dictionary.seo?.description ?? dictionary.hero?.subtitle ?? ''
    : dictionary.howItWorks?.seo?.description ?? ''
  const organizationId = `${BASE_URL}/#organization`
  const websiteId = `${BASE_URL}/#website`
  const softwareId = `${BASE_URL}/#software`
  const graph = [
    {
      '@type': 'Organization', '@id': organizationId, name: 'SmoothScroll', url: `${BASE_URL}/`,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/icon-128.png` },
      sameAs: ['https://github.com/quangtruong2003/SmoothScroll'],
    },
    {
      '@type': 'WebSite', '@id': websiteId, url: `${BASE_URL}/`, name: 'SmoothScroll',
      publisher: { '@id': organizationId }, inLanguage: htmlLang(locale),
    },
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description,
      isPartOf: { '@id': websiteId }, about: { '@id': softwareId }, author: { '@id': organizationId },
      dateModified: '2026-07-19', inLanguage: htmlLang(locale),
    },
    {
      '@type': 'SoftwareApplication', '@id': softwareId, name: 'SmoothScroll', operatingSystem: 'Windows',
      applicationCategory: 'UtilitiesApplication', description, url: `${BASE_URL}/`, publisher: { '@id': organizationId },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, softwareVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'latest',
      screenshot: `${BASE_URL}/assets/screen-poster.webp`, license: 'https://github.com/quangtruong2003/SmoothScroll/blob/master/LICENSE',
    },
    ...(page === 'home' && dictionary.geo?.faqQuestion && dictionary.geo.faqAnswer ? [{
      '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: [{
        '@type': 'Question', name: dictionary.geo.faqQuestion,
        acceptedAnswer: { '@type': 'Answer', text: dictionary.geo.faqAnswer },
      }],
    }] : []),
  ]

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') }} />
}
