import { describe, expect, it } from 'vitest'
import { intentLinks } from './intent-links'
import { buildIntentMetadata, intentPages, intentUrl } from './intent-pages'

describe('SEO intent pages', () => {
  it('defines one unique crawlable page for every intent link', () => {
    expect(intentPages.map((page) => page.slug)).toEqual(intentLinks.map((page) => page.slug))
    expect(new Set(intentPages.map((page) => page.slug)).size).toBe(5)
  })

  it('publishes a self-canonical and unique title for each page', () => {
    const titles = new Set<string>()

    for (const page of intentPages) {
      const metadata = buildIntentMetadata(page)
      expect(metadata.alternates?.canonical).toBe(intentUrl(page.slug))
      expect(page.title).toContain('SmoothScroll')
      expect(page.description.length).toBeGreaterThan(100)
      expect(titles.has(page.title)).toBe(false)
      titles.add(page.title)
    }
  })

  it('keeps visible FAQ content substantial enough for matching FAQ schema', () => {
    for (const page of intentPages) {
      expect(page.faq.length).toBeGreaterThanOrEqual(3)
      for (const item of page.faq) {
        expect(item.question.length).toBeGreaterThan(15)
        expect(item.answer.length).toBeGreaterThan(60)
      }
    }
  })
})
