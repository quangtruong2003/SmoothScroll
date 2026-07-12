import type { Metadata } from 'next'
import { LanguageProvider } from '@/lib/i18n/provider'
import { JsonLd } from './JsonLd'
import './globals.css'
import '@/styles/tray.css'
import '@/styles/marquee.css'

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
  other: {
    // GitHub Pages caches HTML by default (max-age=600). Force revalidation
    // in browsers so users see fresh content after each deploy.
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  openGraph: {
    title: 'SmoothScroll - Natural Scroll Feel on Windows',
    description:
      'A 120 Hz easing engine for every wheel tick, in every app. Free, no telemetry, open-source.',
    url: BASE_URL,
    siteName: 'SmoothScroll',
    type: 'website',
    images: [
      {
        url: `${BASE_URL}/assets/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'SmoothScroll – Natural scroll feel on Windows',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmoothScroll - Natural Scroll Feel on Windows',
    description:
      'A 120 Hz easing engine for every wheel tick, in every app. Free, no telemetry, open-source.',
    images: [`${BASE_URL}/assets/og-image.png`],
  },
  alternates: {
    canonical: BASE_URL,
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
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'latest'

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Global Chunk Error Auto-Recovery & Cache Buster */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 1. Version cache busting
                var currentVer = ${JSON.stringify(version)};
                try {
                  var storedVer = localStorage.getItem('app_version');
                  if (storedVer && storedVer !== currentVer) {
                    localStorage.setItem('app_version', currentVer);
                    // Clear service worker if exists
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        for(var i = 0; i < regs.length; i++) { regs[i].unregister(); }
                      });
                    }
                    console.log('New version detected:', currentVer, '. Reloading...');
                    window.location.reload(true);
                    return;
                  }
                  localStorage.setItem('app_version', currentVer);
                } catch(e) {}

                // 2. Global chunk load error handler
                window.addEventListener('error', function(e) {
                  if (e && e.message && (
                    e.message.indexOf('chunk') !== -1 ||
                    e.message.indexOf('Loading CSS chunk') !== -1 ||
                    e.message.indexOf('Loading chunk') !== -1
                  )) {
                    console.warn('Chunk load failed. Force reloading page...', e);
                    window.location.reload(true);
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body>
        <JsonLd />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
