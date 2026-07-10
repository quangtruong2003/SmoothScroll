import type { Metadata } from 'next'
import { LanguageProvider } from '@/lib/i18n/provider'
import './globals.css'
import '@/styles/tray.css'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const BASE_URL = 'https://smoothscroll.top'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll - Natural Scroll Feel on Windows',
  },
  description:
    'A 120 Hz easing engine for every wheel tick, in every app. Built for people who notice the difference between smooth scroll and stuttering. Free, no telemetry, open-source.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'SmoothScroll - Natural Scroll Feel on Windows',
    description:
      'A 120 Hz easing engine for every wheel tick, in every app. Free, no telemetry, open-source.',
    type: 'website',
  },
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
