import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marquee Debug',
  robots: { index: false, follow: false },
}

export default function MarqueeDebugLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
