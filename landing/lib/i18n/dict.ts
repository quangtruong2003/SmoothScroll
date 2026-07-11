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
    eyebrowLinux?: string
    eyebrowMac?: string
    title?: string
    titleAccent?: string
    subtitle?: string
    cta?: string
    ctaLinux?: string
    ctaMac?: string
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
    version?: string
    fallback?: { stars?: string; version?: string }
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
      linux?: { label?: string; steps?: string[] }
    }
    filename?: string
    note?: { windows?: string; macos?: string; linux?: string }
    cta?: string
    ctaMac?: string
    ctaLinux?: string
  }
  faq?: {
    title?: string
    questions?: { q?: string; a?: string }[]
  }
  finalCta?: {
    title?: string
    subtitle?: string
    cta?: string
    ctaLinux?: string
    ctaMac?: string
    ctaSub?: string
    comingSoon?: string
  }
  exitIntent?: {
    title?: string
    message?: string
    cta?: string
    ctaLinux?: string
    ctaMac?: string
  }
  beta?: {
    badge?: string
    notice?: string
    reportPrefix?: string
    reportLink?: string
  }
  footer?: {
    tagline?: string
    taglineWindows?: string
    taglineMac?: string
    taglineLinux?: string
    taglineFallback?: string
    links?: {
      github?: string
      license?: string
    }
  }
  howItWorks?: {
    seo?: { title?: string; description?: string }
    hero?: {
      eyebrow?: string
      title?: string
      titleAccent?: string
      subtitle?: string
      ctaPrimary?: string
      ctaSecondary?: string
      backToHome?: string
    }
    demo?: {
      caption?: string
      alt?: string
      hint?: string
      placeholder?: string
    }
    bigPicture?: {
      title?: string
      subtitle?: string
      steps?: { title?: string; description?: string }[]
    }
    tabs?: {
      title?: string
      subtitle?: string
      tocLabel?: string
      sections?: {
        id?: string
        label?: string
        intro?: string
        settings?: {
          name?: string
          what?: string
          why?: string
          range?: string
          defaultValue?: string
          tip?: string
        }[]
      }[]
    }
    shortcuts?: {
      title?: string
      subtitle?: string
      tableHeaders?: { action?: string; keys?: string; scope?: string }
      rows?: { action?: string; keys?: string; scope?: string }[]
      hotkeyNote?: string
    }
    tray?: {
      title?: string
      subtitle?: string
      leftClick?: { title?: string; description?: string; items?: string[] }
      rightClick?: { title?: string; description?: string; items?: string[] }
      perApp?: { title?: string; description?: string }
    }
    recipes?: {
      title?: string
      subtitle?: string
      items?: { name?: string; scenario?: string; suggestion?: string; settings?: string[] }[]
    }
    privacy?: {
      title?: string
      points?: string[]
    }
    easingViz?: {
      title?: string
      subtitle?: string
      curves?: {
        exponentialOut?: string
        cubicOut?: string
        quinticOut?: string
        linear?: string
      }
    }
    finalCta?: {
      title?: string
      subtitle?: string
      cta?: string
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

/** Returns locale prefix for URLs. Default locale returns empty string. */
export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? '' : `/${locale}`
}

/** Build URL path. Avoids double-slash for default locale. basePath NOT included — Next.js <Link> handles it. */
export function localePath(locale: Locale, path: string): string {
  const prefix = localePrefix(locale)
  const joined = `${prefix}${path}`
  return joined.replace('//', '/') || '/'
}
