import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        <BackgroundDotGrid />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
