import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll — Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
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
        <link rel="icon" type="image/png" href="/assets/icon-128.png" />
        <link rel="apple-touch-icon" href="/assets/icon-128.png" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
