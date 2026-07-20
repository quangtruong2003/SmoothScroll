import type { ReactNode } from 'react'
import { LanguageProvider } from '@/lib/i18n/provider'
import type { Dictionary, Locale } from '@/lib/i18n/dict'
import { htmlLang } from '@/lib/i18n/routing'

interface LocalizedRootLayoutProps {
  children: ReactNode
  locale: Locale
  dictionary: Dictionary
}

export function LocalizedRootLayout({ children, locale, dictionary }: LocalizedRootLayoutProps) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'latest'

  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var v=${JSON.stringify(version)};try{var s=localStorage.getItem('app_version');if(s&&s!==v){localStorage.setItem('app_version',v);if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(r){for(var i=0;i<r.length;i++){r[i].unregister()}})}window.location.reload();return}localStorage.setItem('app_version',v)}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <LanguageProvider initialLocale={locale} initialDictionary={dictionary}>{children}</LanguageProvider>
      </body>
    </html>
  )
}
