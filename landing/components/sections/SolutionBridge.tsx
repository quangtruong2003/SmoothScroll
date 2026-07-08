'use client'

import { FadeUp } from '@/components/motion/FadeUp'

interface SolutionBridgeProps {
  dict: { solutionBridge?: { line?: string } }
}

export function SolutionBridge({ dict }: SolutionBridgeProps) {
  return (
    <section className="py-12 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-3xl sm:text-4xl font-bold text-center leading-snug max-w-3xl mx-auto">
            {dict?.solutionBridge?.line ?? ''}
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
