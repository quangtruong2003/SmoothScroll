import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dict'

const BASE = 'https://grayscut.github.io/SmoothScroll'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/en`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/vi`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/zh`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ]
}
