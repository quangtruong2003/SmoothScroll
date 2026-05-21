'use client'

import { ShieldCheck, Check } from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

interface PrivacyProps {
  privacy: NonNullable<NonNullable<Dictionary['howItWorks']>['privacy']>
}

export function Privacy({ privacy }: PrivacyProps) {
  const points = privacy.points ?? []

  return (
    <section className="py-16 sm:py-24 px-4 border-t">
      <div className="container max-w-5xl">
        <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-12 items-start">
          <FadeUp>
            <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:max-w-xs">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight lg:mt-4">
                {privacy.title}
              </h2>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <ul className="space-y-3">
              {points.map((point, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3.5"
                >
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-foreground/85 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
