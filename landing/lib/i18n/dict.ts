export type Locale = 'en' | 'vi' | 'zh'

export const locales: Locale[] = ['en', 'vi', 'zh']
export const defaultLocale: Locale = 'en'

export interface Dictionary {
  nav?: {
    github?: string
    stars?: string
    pricing?: string
    features?: string
    language?: string
  }
  langSwitcher?: {
    select?: string
    en?: string
    vi?: string
    zh?: string
  }
  hero?: {
    eyebrow?: string
    title?: string
    titleAccent?: string
    subtitle?: string
    cta?: string
    ctaFallback?: string
    trustLine?: string
    seeHow?: string
    demoPrompt?: string
    demoToast?: string
  }
  painPoints?: {
    title?: string
    points?: { title?: string; description?: string }[]
  }
  solutionBridge?: {
    line?: string
  }
  features?: {
    title?: string
    items?: { title?: string; description?: string }[]
  }
  useCases?: {
    title?: string
    tabs?: {
      reading?: { label?: string; description?: string }
      coding?: { label?: string; description?: string }
      designing?: { label?: string; description?: string }
    }
  }
  trayPreview?: {
    title?: string
    subtitle?: string
  }
  stats?: {
    title?: string
    githubStars?: string
    downloads?: string
    version?: string
    fallback?: { stars?: string; downloads?: string; version?: string }
  }
  indie?: {
    title?: string
    subtitle?: string
    points?: string[]
    cta?: string
  }
  install?: {
    title?: string
    subtitle?: string
    tabs?: {
      windows?: { label?: string; steps?: string[] }
      macos?: { label?: string; steps?: string[] }
    }
    filename?: string
    note?: { windows?: string; macos?: string }
    cta?: string
  }
  faq?: {
    title?: string
    questions?: { q?: string; a?: string }[]
  }
  finalCta?: {
    title?: string
    description?: string
    cta?: string
    ctaSub?: string
  }
  exitIntent?: {
    title?: string
    message?: string
    cta?: string
  }
  footer?: {
    tagline?: string
    links?: {
      github?: string
      license?: string
    }
  }
}

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./en.json').then((m) => m.default as Dictionary),
  vi: () => import('./vi.json').then((m) => m.default as Dictionary),
  zh: () => import('./zh.json').then((m) => m.default as Dictionary),
}

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]?.() ?? dictionaries[defaultLocale]()
}
