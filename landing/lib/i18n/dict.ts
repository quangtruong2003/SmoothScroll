import type { en } from './en'

export type Dict = typeof en

export type Locale = 'en' | 'vi' | 'zh'

export const locales: Locale[] = ['en', 'vi', 'zh']
export const defaultLocale: Locale = 'en'

const dictionaries: Record<Locale, () => Promise<Dict>> = {
  en: () => import('./en.json').then((m) => m as Dict),
  vi: () => import('./vi.json').then((m) => m as Dict),
  zh: () => import('./zh.json').then((m) => m as Dict),
}

export function getDictionary(locale: Locale): Promise<Dict> {
  return dictionaries[locale]?.() ?? dictionaries[defaultLocale]()
}
