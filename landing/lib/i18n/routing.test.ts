import { describe, expect, it } from 'vitest'
import { getDictionary, getDictionarySync } from './dict'
import { htmlLang, localeAlternates, localePath } from './routing'

describe('locale routing', () => {
  it.each([
    ['en', 'home', '/'],
    ['vi', 'home', '/vi/'],
    ['zh', 'home', '/zh/'],
    ['en', 'how-it-works', '/how-it-works/'],
    ['vi', 'how-it-works', '/vi/how-it-works/'],
    ['zh', 'how-it-works', '/zh/how-it-works/'],
  ] as const)('maps %s %s to %s', (locale, page, expected) => {
    expect(localePath(locale, page)).toBe(expected)
  })

  it('returns reciprocal language alternates', () => {
    expect(localeAlternates('home')).toEqual({
      en: 'https://smoothscroll.top/',
      vi: 'https://smoothscroll.top/vi/',
      'zh-Hans': 'https://smoothscroll.top/zh/',
      'x-default': 'https://smoothscroll.top/',
    })
  })

  it('returns page-specific language alternates', () => {
    expect(localeAlternates('how-it-works')).toEqual({
      en: 'https://smoothscroll.top/how-it-works/',
      vi: 'https://smoothscroll.top/vi/how-it-works/',
      'zh-Hans': 'https://smoothscroll.top/zh/how-it-works/',
      'x-default': 'https://smoothscroll.top/how-it-works/',
    })
  })

  it('uses valid BCP 47 HTML language tags', () => {
    expect(htmlLang('en')).toBe('en')
    expect(htmlLang('vi')).toBe('vi')
    expect(htmlLang('zh')).toBe('zh-Hans')
  })
})

describe('dictionary lookup', () => {
  it('returns the same dictionary from sync and async APIs', async () => {
    expect(getDictionarySync('vi')).toBe(await getDictionary('vi'))
  })
})
