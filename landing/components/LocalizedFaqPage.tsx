'use client'

import Link from 'next/link'
import { JsonLd } from '@/app/JsonLd'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import type { Dictionary, Locale } from '@/lib/i18n/dict'
import { localePath } from '@/lib/i18n/routing'
import { faqAnchorId, faqQuestions } from '@/lib/seo/faq'

interface LocalizedFaqPageProps {
  locale: Locale
  dictionary: Dictionary
}

export function LocalizedFaqPage({ locale, dictionary: d }: LocalizedFaqPageProps) {
  const questions = faqQuestions(d)

  return (
    <>
      <JsonLd locale={locale} page="faq" dictionary={d} />
      <BackgroundDotGrid />
      <Navigation locale={locale} pageKind="faq" />
      <main id="main-content" className="flex-1">
        <section className="px-4 pt-32 pb-8">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Link href={localePath(locale, 'home')} className="hover:text-foreground transition-colors">
                  {d.faq?.backToHome ?? 'Back to home'}
                </Link>
              </p>
              <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-balance">
                {d.faq?.title}
              </h1>
              {d.faq?.subtitle && (
                <p className="mt-4 text-lg text-muted-foreground text-pretty">{d.faq.subtitle}</p>
              )}
            </div>
          </div>
        </section>
        {questions.length > 8 && (
          <nav aria-label="All questions" className="px-4 pb-4">
            <div className="container">
              <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
                {questions.map((item, idx) => (
                  <li key={faqAnchorId(item.q, idx)}>
                    <a
                      href={`#${faqAnchorId(item.q, idx)}`}
                      className="inline-block rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {item.q.length > 48 ? `${item.q.slice(0, 48)}…` : item.q}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
        <FAQ dict={{ faq: d.faq }} />
        <FinalCTA dict={{ finalCta: d.finalCta }} />
      </main>
      <Footer />
    </>
  )
}
