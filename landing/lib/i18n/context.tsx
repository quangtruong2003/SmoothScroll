'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { locales, defaultLocale, type Locale } from './dict'

export type { Locale }
export { locales, defaultLocale }

export const STORAGE_KEY = 'smoothscroll-locale'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  dict: Record<string, unknown> | null
  dictLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function detectInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale
    }
  }
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('vi')) return 'vi'
  if (browserLang.startsWith('zh')) return 'zh'
  return defaultLocale
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [dict, setDict] = useState<Record<string, unknown> | null>(null)
  const [dictLoading, setDictLoading] = useState(true)

  useEffect(() => {
    const initial = detectInitialLocale()
    setLocaleState(initial)
    loadDict(initial)
  }, [])

  useEffect(() => {
    if (locale !== defaultLocale) {
      localStorage.setItem(STORAGE_KEY, locale)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [locale])

  async function loadDict(loc: Locale) {
    setDictLoading(true)
    try {
      const module = await import(`./${loc}.json`)
      setDict(module.default)
    } catch {
      const module = await import('./en.json')
      setDict(module.default)
    }
    setDictLoading(false)
  }

  function setLocale(loc: Locale) {
    setLocaleState(loc)
    loadDict(loc)
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dict, dictLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
