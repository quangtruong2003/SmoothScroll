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
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full">
            <div className="text-center">
              {imgError.before ? (
                <div className="rounded-lg border border-border max-w-[650px] w-full h-[366px] bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  Before (demo unavailable)
                </div>
              ) : (
                <img
                  src={`${BASE_PATH}/assets/before.gif`}
                  alt="Jumpy, sluggish scrolling on Windows without SmoothScroll"
                  className="rounded-lg border border-border max-w-[650px] w-full"
                  width={650}
                  height={366}
                  loading="lazy"
                  onError={() => setImgError((p) => ({ ...p, before: true }))}
                />
              )}
              <p className="text-xs text-muted-foreground mt-2">Before</p>
            </div>
            <div className="text-center">
              {imgError.after ? (
                <div className="rounded-lg border border-border max-w-[650px] w-full h-[366px] bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  After (demo unavailable)
                </div>
              ) : (
                <img
                  src={`${BASE_PATH}/assets/after.gif`}
                  alt="Smooth, fluid scrolling on Windows with SmoothScroll installed"
                  className="rounded-lg border border-border max-w-[650px] w-full"
                  width={650}
                  height={366}
                  loading="lazy"
                  onError={() => setImgError((p) => ({ ...p, after: true }))}
                />
              )}
              <p className="text-xs text-muted-foreground mt-2">After</p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
