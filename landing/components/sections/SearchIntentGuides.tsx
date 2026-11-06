'use client'

import Link from 'next/link'
import { intentLinks, intentPath, type IntentSlug } from '@/lib/seo/intent-links'

export function SearchIntentGuides({ currentSlug }: { currentSlug?: IntentSlug }) {
  const guides = currentSlug ? intentLinks.filter((guide) => guide.slug !== currentSlug) : intentLinks

  return (
    <section aria-labelledby="windows-scroll-guides" className="container py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Windows scrolling guides</p>
          <h2 id="windows-scroll-guides" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Fix the scroll feel you actually notice
          </h2>
          <p className="mt-3 text-muted-foreground">
            Choose the guide closest to your setup. Each page explains the problem, the relevant SmoothScroll controls, and a practical starting configuration.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={intentPath(guide.slug)}
              className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <h3 className="font-semibold">{guide.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-primary">Read guide →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
