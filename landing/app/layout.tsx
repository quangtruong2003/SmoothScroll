import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://grayscut.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll — Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
