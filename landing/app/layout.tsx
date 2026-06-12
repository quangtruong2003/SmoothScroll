import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import './globals.css'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.add(r);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <BackgroundDotGrid />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
