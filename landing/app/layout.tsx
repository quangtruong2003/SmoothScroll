import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

const BASE_PATH = process.env.NODE_ENV === 'production' ? '/SmoothScroll' : ''

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll — Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: `${BASE_PATH}/assets/icon-128.png`,
    apple: `${BASE_PATH}/assets/icon-128.png`,
  },
}

const themeScript = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(e){if(e.matches){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}};apply(m);if(m.addEventListener){m.addEventListener('change',apply)}else{m.addListener(apply)}}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
