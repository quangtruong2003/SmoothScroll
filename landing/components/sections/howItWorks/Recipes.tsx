'use client'

import { Sparkles, ChevronRight } from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import type { Dictionary } from '@/lib/i18n/dict'

interface RecipesProps {
  recipes: NonNullable<NonNullable<Dictionary['howItWorks']>['recipes']>
}

export function Recipes({ recipes }: RecipesProps) {
  const items = recipes.items ?? []

  return (
    <section className="py-16 sm:py-24 px-4 border-t bg-muted/20">
      <div className="container max-w-5xl">
        <FadeUp>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {recipes.title}
            </h2>
          </div>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {recipes.subtitle}
          </p>
        </FadeUp>

        <StaggerContainer className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors"
            >
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {item.scenario}
              </p>

              {item.suggestion && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                  <ChevronRight className="h-3 w-3" />
                  {item.suggestion}
                </div>
              )}

              {(item.settings ?? []).length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t pt-4">
                  {(item.settings ?? []).map((s, j) => (
                    <li
                      key={j}
                      className="text-xs text-foreground/80 font-mono leading-relaxed"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
