import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dict'
import { absoluteLocaleUrl, BASE_URL, CONTENT_UPDATED, type PageKind } from '@/lib/i18n/routing'
import { INTENT_CONTENT_UPDATED, intentLinks, intentPath } from '@/lib/seo/intent-links'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: PageKind[] = ['home', 'how-it-works']
  const localizedPages = locales.flatMap((locale) => pages.map((page) => ({
    url: absoluteLocaleUrl(locale, page),
    lastModified: CONTENT_UPDATED,
    changeFrequency: page === 'home' ? 'weekly' as const : 'monthly' as const,
    priority: page === 'home' ? 1 : 0.8,
  })))
  const intentPages = intentLinks.map(({ slug }) => ({
    url: `${BASE_URL}${intentPath(slug)}`,
    lastModified: INTENT_CONTENT_UPDATED,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...localizedPages, ...intentPages]
}
