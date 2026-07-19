'use client'

import Image from 'next/image'
import { FadeUp } from '@/components/motion/FadeUp'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface SolutionBridgeProps {
  dict: { solutionBridge?: { line?: string } }
}

export function SolutionBridge({ dict }: SolutionBridgeProps) {
  return (
    <section className="py-12 px-4" data-solution-bridge>
      <div className="container">
        <FadeUp>
          <p className="text-3xl sm:text-4xl font-bold text-center leading-snug max-w-3xl mx-auto">
            <span aria-hidden="true" className="mr-2 inline-flex align-middle">
              <Image src={`${BASE_PATH}/assets/icon-128.png`} alt="" width={36} height={36} className="h-8 w-8 rounded-lg" />
            </span>
            <span>{dict?.solutionBridge?.line ?? ''}</span>
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
