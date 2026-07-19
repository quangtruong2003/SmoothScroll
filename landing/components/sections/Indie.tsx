'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { Button } from '@/components/ui/button'
import { Github, Check } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

interface IndieProps {
  dict: { indie?: Dictionary['indie'] }
}

export function Indie({ dict }: IndieProps) {
  const i = dict?.indie ?? { title: '', subtitle: '', points: [], cta: '' }

  return (
    <section className="py-32 px-4 md:py-48">
      <div className="container">
        <div className="mx-auto max-w-2xl">
          <FadeUp>
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">{i.title}</h2>
              <p className="text-lg text-muted-foreground">{i.subtitle}</p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <ul className="mx-auto mb-12 grid w-full max-w-3xl gap-x-8 gap-y-4 sm:grid-cols-2">
              {(i.points ?? []).map((point, idx) => (
                <li key={idx} className="flex min-w-0 items-start gap-3 border-t py-4 first:border-t-0 sm:first:border-t">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                  <p className="text-sm font-medium leading-relaxed">{point}</p>
                </li>
              ))}
            </ul>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="text-center">
              <Button variant="outline" size="lg" asChild>
                <a href="https://github.com/quangtruong2003/SmoothScroll" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  {i.cta}
                </a>
              </Button>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}