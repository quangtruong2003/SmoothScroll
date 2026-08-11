import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dict'
import { absoluteLocaleUrl, CONTENT_UPDATED, type PageKind } from '@/lib/i18n/routing'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: PageKind[] = ['home', 'how-it-works']

  return locales.flatMap((locale) => pages.map((page) => ({
    url: absoluteLocaleUrl(locale, page),
    lastModified: CONTENT_UPDATED,
    changeFrequency: page === 'home' ? 'weekly' : 'monthly',
    priority: page === 'home' ? 1 : 0.8,
  })))
}
