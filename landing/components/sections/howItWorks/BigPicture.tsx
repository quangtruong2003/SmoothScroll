'use client'

import { MousePointer2, Activity, Zap } from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [MousePointer2, Activity, Zap]

interface BigPictureProps {
  bigPicture: NonNullable<NonNullable<Dictionary['howItWorks']>['bigPicture']>
}

export function BigPicture({ bigPicture }: BigPictureProps) {
  const steps = bigPicture.steps ?? []

  return (
    <section className="py-16 sm:py-24 px-4 border-t">
      <div className="container max-w-5xl">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {bigPicture.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            {bigPicture.subtitle}
          </p>
        </FadeUp>

        <div className="flex justify-center mt-12">
          <StaggerContainer className="grid sm:grid-cols-3 gap-6">
            {steps.map((step, idx) => {
              const Icon = ICONS[idx % ICONS.length]
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  className="relative p-6 rounded-xl border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  {idx < steps.length - 1 && (
                    <div
                      aria-hidden
                      className="hidden sm:block absolute top-1/2 -right-4 h-px w-8 bg-gradient-to-r from-border to-transparent"
                    />
                  )}
                </motion.div>
              )
            })}
          </StaggerContainer>
        </div>
      </div>
    </section>
  )
}
