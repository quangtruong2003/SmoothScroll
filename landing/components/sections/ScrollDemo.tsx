'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { useState } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function ScrollDemo() {
  const [imgError, setImgError] = useState({ before: false, after: false })

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <div data-scroll-demo className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div data-scroll-before className="text-center">
              {imgError.before ? (
                <div data-scroll-demo-fallback className="rounded-lg border border-border w-full aspect-[650/366] bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  Before (demo unavailable)
                </div>
              ) : (
                <video
                  aria-label="Jumpy, sluggish scrolling on Windows without SmoothScroll"
                  poster={`${BASE_PATH}/assets/before-poster.webp`}
                  className="rounded-lg border border-border w-full"
                  width={946}
                  height={482}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  onError={() => setImgError((current) => ({ ...current, before: true }))}
                >
                  <source src={`${BASE_PATH}/assets/before.webm`} type="video/webm" />
                </video>
              )}
              <p className="text-xs text-muted-foreground mt-2">Before</p>
            </div>
            <div data-scroll-after className="text-center">
              {imgError.after ? (
                <div data-scroll-demo-fallback className="rounded-lg border border-border w-full aspect-[650/366] bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  After (demo unavailable)
                </div>
              ) : (
                <video
                  aria-label="Smooth, fluid scrolling on Windows with SmoothScroll installed"
                  poster={`${BASE_PATH}/assets/after-poster.webp`}
                  className="rounded-lg border border-border w-full"
                  width={943}
                  height={480}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  onError={() => setImgError((current) => ({ ...current, after: true }))}
                >
                  <source src={`${BASE_PATH}/assets/after.webm`} type="video/webm" />
                </video>
              )}
              <p className="text-xs text-muted-foreground mt-2">After</p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
