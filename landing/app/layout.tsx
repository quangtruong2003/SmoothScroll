import type { Metadata } from 'next'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll - Natural Scroll Feel on Windows',
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
  return children
}
