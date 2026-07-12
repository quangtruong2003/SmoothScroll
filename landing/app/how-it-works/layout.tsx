import type { Metadata } from 'next'
import { JsonLd } from '../JsonLd'

const BASE_URL = 'https://smoothscroll.top'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how SmoothScroll brings 120 Hz easing to every scroll wheel tick on Windows. Easing curves, per-app overrides, and global tray control explained.',
  openGraph: {
    title: 'How It Works | SmoothScroll',
    description:
      'See how SmoothScroll brings 120 Hz easing to every scroll wheel tick on Windows.',
    url: `${BASE_URL}/how-it-works`,
    siteName: 'SmoothScroll',
    type: 'website',
    images: [
      {
        url: `${BASE_URL}/assets/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'SmoothScroll – How It Works',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works | SmoothScroll',
    description:
      'See how SmoothScroll brings 120 Hz easing to every scroll wheel tick on Windows.',
    images: [`${BASE_URL}/assets/og-image.png`],
  },
  alternates: {
    canonical: `${BASE_URL}/how-it-works`,
  },
}

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <JsonLd path="/how-it-works" />
      {children}
    </>
  )
}
