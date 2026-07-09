import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Toaster } from 'sonner'
import { getDictionary, locales, localePrefix, type Locale } from '@/lib/i18n/dict'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import '../globals.css'

export async function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = lang as Locale
  const dict = await getDictionary(locale)

  return {
    title: 'SmoothScroll - Natural Scroll Feel on Windows',
    description: dict.hero?.subtitle,
    alternates: {
      canonical: `/${localePrefix(locale)}`,
      languages: {
        en: '/',
        vi: '/vi',
        zh: '/zh',
        'zh-Hans': '/zh',
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_Hans' : locale,
      alternateLocale: locale === 'zh' ? ['en', 'vi'] : (locale === 'en' ? ['vi', 'zh'] : ['en']),
      images: [{ url: '/assets/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang as Locale
  if (!locales.includes(locale)) notFound()

  const dict = await getDictionary(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <link
          rel="preload"
          as="image"
          href="/assets/og-image.png"
          fetchPriority="high"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.classList.add(r);d.style.background=r==='dark'?'hsl(240,10%,3.9%)':'hsl(0,0%,100%)';d.style.color=r==='dark'?'hsl(0,0%,98%)':'hsl(240,10%,3.9%)';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <BackgroundDotGrid />
        <Navigation
          locale={locale}
          langSwitcherDict={dict.langSwitcher ?? {}}
        />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer locale={locale} dict={{ footer: dict.footer ?? { tagline: '', links: { github: '', license: '' } } }} />
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
