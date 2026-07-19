import type { Metadata } from 'next'
import { LocalizedRootLayout } from '@/components/LocalizedRootLayout'
import { getDictionarySync } from '@/lib/i18n/dict'
import '../globals.css'
import '@/styles/tray.css'
import '@/styles/marquee.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://smoothscroll.top'),
  robots: { index: true, follow: true },
  icons: { icon: '/assets/icon-128.png', apple: '/assets/icon-128.png' },
}

export default function ChineseRootLayout({ children }: { children: React.ReactNode }) {
  return <LocalizedRootLayout locale="zh" dictionary={getDictionarySync('zh')}>{children}</LocalizedRootLayout>
}
