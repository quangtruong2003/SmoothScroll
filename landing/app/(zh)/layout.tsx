import type { Metadata, Viewport } from 'next'
import { LocalizedRootLayout } from '@/components/LocalizedRootLayout'
import { getDictionarySync } from '@/lib/i18n/dict'
import '../globals.css'
import '@/styles/tray.css'
import '@/styles/marquee.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://smoothscroll.top'),
  applicationName: 'SmoothScroll',
  robots: { index: true, follow: true },
  icons: { icon: '/assets/icon-128.png', apple: '/assets/icon-128.png' },
}

export default function ChineseRootLayout({ children }: { children: React.ReactNode }) {
  return <LocalizedRootLayout locale="zh" dictionary={getDictionarySync('zh')}>{children}</LocalizedRootLayout>
}
