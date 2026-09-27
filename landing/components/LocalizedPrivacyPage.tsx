import { BackToHome } from '@/components/BackToHome'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface LocalizedPrivacyPageProps {
  locale: Locale
  dictionary: Dictionary
}

export function LocalizedPrivacyPage({ locale, dictionary: d }: LocalizedPrivacyPageProps) {
  const p = d.privacy

  return (
    <>
      <BackgroundDotGrid />
      <Navigation locale={locale} pageKind="privacy" />
      <main id="main-content" className="flex-1">
        <article className="px-4 pt-28 pb-16">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <BackToHome locale={locale} label={p?.backToHome ?? 'Back to home'} className="mb-8" />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
                {p?.title ?? 'Privacy Policy'}
              </h1>
              {p?.subtitle && (
                <p className="mt-4 text-lg text-muted-foreground text-pretty">{p.subtitle}</p>
              )}
              {p?.updated && (
                <p className="mt-2 text-sm text-muted-foreground">{p.updated}</p>
              )}
              {p?.intro && (
                <p className="mt-10 leading-relaxed text-foreground/90">{p.intro}</p>
              )}
              <div className="mt-10 space-y-10">
                {(p?.sections ?? []).map((section, idx) => (
                  <section key={idx}>
                    <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
                    {(section.paragraphs ?? []).map((paragraph, pIdx) => (
                      <p key={pIdx} className="mt-3 leading-relaxed text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
                        {section.bullets.map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {section.outro && (
                      <p className="mt-3 leading-relaxed text-muted-foreground">{section.outro}</p>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
