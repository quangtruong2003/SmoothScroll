import { FadeUp } from '@/components/motion/FadeUp'

interface SolutionBridgeProps {
  dict: {
    solutionBridge: { line: string }
  }
}

export function SolutionBridge({ dict }: SolutionBridgeProps) {
  return (
    <section className="py-12 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-2xl sm:text-3xl font-bold text-center leading-snug">
            {dict.solutionBridge.line}
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
