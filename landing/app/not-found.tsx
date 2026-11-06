import './globals.css'
import { LanguageProvider } from '@/lib/i18n/provider'
import { getDictionarySync } from '@/lib/i18n/dict'
import { BackToHome } from '@/components/BackToHome'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

// Lives outside the locale route groups, so it carries its own provider and
// global stylesheet (the group layouts never apply to /_not-found).
export default function NotFound() {
  return (
    <LanguageProvider initialLocale="en" initialDictionary={getDictionarySync('en')}>
      <BackgroundDotGrid />
      <Navigation locale="en" />
      <main id="main-content" className="flex-1">
        <section className="px-4 pt-28 pb-24">
          <div className="container max-w-3xl">
            <BackToHome locale="en" label="Back to home" className="mb-12" />
            <div className="text-center">
              <h1 className="text-4xl font-bold">404</h1>
              <p className="mt-2 text-muted-foreground">Page not found.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </LanguageProvider>
  )
}
