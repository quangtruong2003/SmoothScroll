import { describe, expect, it } from 'vitest'
import { getDictionarySync } from '@/lib/i18n/dict'
import { HOME_FAQ_LIMIT, faqAnchorId, faqQuestions, homeFaqQuestions } from './faq'

describe('faq seo helpers', () => {
  it('keeps homepage subset small while /faq/ holds the full set', () => {
    const all = faqQuestions(getDictionarySync('en'))
    const home = homeFaqQuestions(getDictionarySync('en'))

    expect(all.length).toBeGreaterThan(20)
    expect(home).toHaveLength(HOME_FAQ_LIMIT)
    expect(home.every(({ q, a }) => q && a)).toBe(true)
  })

  it('generates unique anchor ids for every question', () => {
    const ids = faqQuestions(getDictionarySync('en')).map(({ q }, idx) => faqAnchorId(q, idx))

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^faq-\d+-[a-z0-9-]+$/.test(id))).toBe(true)
  })

  it('gives every locale faq seo title, description, and navigation labels', () => {
    for (const locale of ['en', 'vi', 'zh'] as const) {
      const faq = getDictionarySync(locale).faq

      expect(faq?.seo?.title).toBeTruthy()
      expect(faq?.seo?.description).toBeTruthy()
      expect(faq?.viewAll).toBeTruthy()
      expect(faq?.backToHome).toBeTruthy()
    }
  })
})
