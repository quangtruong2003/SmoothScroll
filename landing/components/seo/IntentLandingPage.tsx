import Link from 'next/link'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Footer } from '@/components/Footer'
import { Navigation } from '@/components/Navigation'
import { SearchIntentGuides } from '@/components/sections/SearchIntentGuides'
import { intentPageBySlug, intentUrl, type IntentPage } from '@/lib/seo/intent-pages'
import { INTENT_CONTENT_UPDATED } from '@/lib/seo/intent-links'

const RELEASE_URL = 'https://github.com/quangtruong2003/SmoothScroll/releases/latest'

function IntentJsonLd({ page }: { page: IntentPage }) {
  const url = intentUrl(page.slug)
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      dateModified: INTENT_CONTENT_UPDATED,
      isPartOf: { '@id': 'https://smoothscroll.top/#website' },
      about: { '@id': 'https://smoothscroll.top/#software' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://smoothscroll.top/#software',
      name: 'SmoothScroll',
      url: 'https://smoothscroll.top/',
      operatingSystem: 'Windows 10, Windows 11',
      applicationCategory: 'UtilitiesApplication',
      isAccessibleForFree: true,
      downloadUrl: RELEASE_URL,
      license: 'https://github.com/quangtruong2003/SmoothScroll/blob/master/LICENSE',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', url: RELEASE_URL },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SmoothScroll', item: 'https://smoothscroll.top/' },
        { '@type': 'ListItem', position: 2, name: page.heading, item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c'),
      }}
    />
  )
}

export function IntentLandingPage({ page }: { page: IntentPage }) {
  const relatedPages = page.related.map((slug) => intentPageBySlug[slug])

  return (
    <>
      <IntentJsonLd page={page} />
      <BackgroundDotGrid />
      <Navigation locale="en" />
      <main id="main-content" className="relative flex-1">
        <section className="container pb-16 pt-28 sm:pb-20 sm:pt-36">
          <div className="mx-auto max-w-4xl">
            <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">SmoothScroll</Link>
              <span aria-hidden="true" className="px-2">/</span>
              <span>{page.eyebrow}</span>
            </nav>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{page.eyebrow}</p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">{page.heading}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">{page.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <DownloadCTA
                label="Download for Windows"
                labelLinux="Download for Linux"
                labelMac="Download for macOS"
                comingSoonLabel="Coming Soon"
              />
              <Link href="/how-it-works/" className="text-sm font-semibold text-primary hover:underline">
                See how SmoothScroll works →
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free for supported use cases. No telemetry. Windows 10 and 11 supported.</p>
          </div>
        </section>

        <section className="container pb-14 sm:pb-16">
          <div className="mx-auto max-w-4xl rounded-2xl border bg-card/80 p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Short answer</p>
            <p className="mt-3 text-lg leading-8">{page.answer}</p>
          </div>
        </section>

        <div className="container pb-8">
          <div className="mx-auto max-w-4xl space-y-14">
            {page.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{section.title}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-muted-foreground sm:text-lg">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">A practical starting setup</h2>
              <ol className="mt-5 space-y-4">
                {page.setup.map((step, index) => (
                  <li key={step} className="flex gap-4 rounded-xl border bg-card/60 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
                    <p className="leading-7 text-muted-foreground">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
              <div className="mt-5 space-y-4">
                {page.faq.map((item) => (
                  <article key={item.question} className="rounded-xl border bg-card/60 p-5">
                    <h3 className="font-semibold">{item.question}</h3>
                    <p className="mt-2 leading-7 text-muted-foreground">{item.answer}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-bold">Related Windows scrolling guides</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {relatedPages.map((related) => (
                  <Link key={related.slug} href={`/${related.slug}/`} className="rounded-xl border p-4 hover:border-primary/50">
                    <h3 className="font-semibold">{related.heading}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{related.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>

        <SearchIntentGuides currentSlug={page.slug} />
      </main>
      <Footer />
    </>
  )
}
