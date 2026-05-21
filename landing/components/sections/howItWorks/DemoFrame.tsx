'use client'

import Image from 'next/image'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface DemoFrameProps {
  demo: NonNullable<NonNullable<Dictionary['howItWorks']>['demo']>
}

export function DemoFrame({ demo }: DemoFrameProps) {
  return (
    <section className="px-4 pb-16 sm:pb-24">
      <div className="container max-w-5xl">
        <FadeUp>
          <div className="relative rounded-2xl border border-border overflow-hidden shadow-2xl shadow-primary/5">
            <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
              <Image
                src={`${BASE_PATH}/assets/screen.gif`}
                alt={demo.alt ?? ''}
                width={1600}
                height={1000}
                className="h-auto w-full"
                unoptimized
                priority
              />
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {demo.caption}
            {demo.hint && (
              <>
                {' · '}
                <span className="text-foreground/70">{demo.hint}</span>
              </>
            )}
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
