'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import en from './en.json'
import { defaultLocale, type Dictionary, type Locale } from './dict'

export type { Locale }
export { locales, defaultLocale } from './dict'

export const STORAGE_KEY = 'smoothscroll-locale'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: Dictionary
}

interface LanguageProviderProps {
  children: ReactNode
  initialLocale?: Locale
  initialDictionary?: Dictionary
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
  initialDictionary,
}: LanguageProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [dict] = useState<Dictionary>(initialDictionary ?? en)

  useEffect(() => {
    if (locale === defaultLocale) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  return <LanguageContext.Provider value={{ locale, setLocale, dict }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
