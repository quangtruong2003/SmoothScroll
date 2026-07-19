import type { Metadata } from 'next'
import { LocalizedRootLayout } from '@/components/LocalizedRootLayout'
import { getDictionarySync } from '@/lib/i18n/dict'
import '../globals.css'
import '@/styles/tray.css'
import '@/styles/marquee.css'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  metadataBase: new URL('https://smoothscroll.top'),
  robots: { index: true, follow: true },
  icons: { icon: `${BASE_PATH}/assets/icon-128.png`, apple: `${BASE_PATH}/assets/icon-128.png` },
}

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return <LocalizedRootLayout locale="en" dictionary={getDictionarySync('en')}>{children}</LocalizedRootLayout>
}
