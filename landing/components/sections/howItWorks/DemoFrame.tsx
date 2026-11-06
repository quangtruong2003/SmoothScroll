'use client'

import { useState } from 'react'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface DemoFrameProps {
  demo: NonNullable<NonNullable<Dictionary['howItWorks']>['demo']>
}

export function DemoFrame({ demo }: DemoFrameProps) {
  const [imgError, setImgError] = useState(false)
  const hasImage = !imgError

  return (
    <section className="px-4 pb-16 sm:pb-24">
      <div className="container max-w-5xl">
        <FadeUp>
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-primary/5">
            <div className="overflow-hidden bg-background">
              {hasImage ? (
                <video
                  aria-label={demo.alt ?? ''}
                  poster={`${BASE_PATH}/assets/screen-poster.webp`}
                  width={796}
                  height={634}
                  className="h-auto w-full"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  onError={() => setImgError(true)}
                >
                  <source src={`${BASE_PATH}/assets/screen.webm`} type="video/webm" />
                </video>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 bg-gradient-to-br from-brand-from/10 to-brand-to/10 border border-dashed border-border m-4 rounded-xl">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {demo.placeholder}
                  </p>
                </div>
              )}
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
