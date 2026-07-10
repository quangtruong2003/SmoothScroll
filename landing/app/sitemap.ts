import type { MetadataRoute } from 'next'

const BASE_URL = 'https://smoothscroll.top'
const BASE = BASE_URL

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: BASE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
