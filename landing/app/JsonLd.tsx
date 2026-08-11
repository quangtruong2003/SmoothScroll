import type { Dictionary, Locale } from '@/lib/i18n/dict'
import { BASE_URL, CONTENT_UPDATED, absoluteLocaleUrl, htmlLang, type PageKind } from '@/lib/i18n/routing'

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
  const releaseUrl = 'https://github.com/quangtruong2003/SmoothScroll/releases/latest'
  const featureList = (dictionary.features?.items ?? [])
    .map((item) => item.title)
    .filter((title): title is string => Boolean(title))
  const faqQuestions = [
    ...(dictionary.geo?.faqQuestion && dictionary.geo.faqAnswer ? [{
      '@type': 'Question',
      name: dictionary.geo.faqQuestion,
      acceptedAnswer: { '@type': 'Answer', text: dictionary.geo.faqAnswer },
    }] : []),
    ...(dictionary.faq?.questions ?? []).flatMap(({ q, a }) => q && a ? [{
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    }] : []),
  ]
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
      dateModified: CONTENT_UPDATED, inLanguage: htmlLang(locale),
    },
    {
      '@type': 'SoftwareApplication', '@id': softwareId, name: 'SmoothScroll', operatingSystem: 'Windows, Linux',
      applicationCategory: 'UtilitiesApplication', description, url: `${BASE_URL}/`, publisher: { '@id': organizationId },
      isAccessibleForFree: true, downloadUrl: releaseUrl, featureList,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', url: releaseUrl }, softwareVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'latest',
      screenshot: `${BASE_URL}/assets/screen-poster.webp`, license: 'https://github.com/quangtruong2003/SmoothScroll/blob/master/LICENSE',
    },
    ...(page === 'home' && faqQuestions.length ? [{
      '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faqQuestions,
    }] : []),
    ...(page === 'how-it-works' ? [{
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SmoothScroll', item: absoluteLocaleUrl(locale, 'home') },
        { '@type': 'ListItem', position: 2, name: title, item: url },
      ],
    }] : []),
  ]

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') }} />
}
