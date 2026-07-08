import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dict'

const BASE = 'https://quangtruong2003.github.io/SmoothScroll'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: BASE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/en`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/vi`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/zh`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/en/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/vi/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/zh/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ]
}
