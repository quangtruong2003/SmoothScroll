import type { Locale } from './dict'

export const BASE_URL = 'https://smoothscroll.top'
export type PageKind = 'home' | 'how-it-works'

const localePrefixes: Record<Locale, string> = { en: '', vi: '/vi', zh: '/zh' }
const languageTags: Record<Locale, 'en' | 'vi' | 'zh-Hans'> = {
  en: 'en',
  vi: 'vi',
  zh: 'zh-Hans',
}

export function localePath(locale: Locale, page: PageKind): string {
  const suffix = page === 'home' ? '/' : '/how-it-works/'
  return `${localePrefixes[locale]}${suffix}`
}

export function absoluteLocaleUrl(locale: Locale, page: PageKind): string {
  return `${BASE_URL}${localePath(locale, page)}`
}

export function localeAlternates(page: PageKind): Record<string, string> {
  return {
    en: absoluteLocaleUrl('en', page),
    vi: absoluteLocaleUrl('vi', page),
    'zh-Hans': absoluteLocaleUrl('zh', page),
    'x-default': absoluteLocaleUrl('en', page),
  }
}

export function htmlLang(locale: Locale): 'en' | 'vi' | 'zh-Hans' {
  return languageTags[locale]
}
