'use client'

import { FadeUp } from '@/components/motion/FadeUp'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function ScrollDemo() {
  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full">
            <div className="text-center">
              <img src={`${BASE_PATH}/assets/before.gif`} alt="Jumpy, sluggish scrolling on Windows without SmoothScroll" className="rounded-lg border border-border max-w-[650px] w-full" width={650} height={366} />
              <p className="text-xs text-muted-foreground mt-2">Before</p>
            </div>
            <div className="text-center">
              <img src={`${BASE_PATH}/assets/after.gif`} alt="Smooth, fluid scrolling on Windows with SmoothScroll installed" className="rounded-lg border border-border max-w-[650px] w-full" width={650} height={366} />
              <p className="text-xs text-muted-foreground mt-2">After</p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
