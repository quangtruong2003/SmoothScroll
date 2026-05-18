'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { forwardRef } from 'react'

interface FadeUpProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  className?: string
  children: React.ReactNode
}

export const FadeUp = forwardRef<HTMLDivElement, FadeUpProps>(
  ({ delay = 0, duration = 0.2, className, children, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration,
          delay,
          ease: prefersReducedMotion ? 'linear' : [0.16, 1, 0.3, 1],
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
FadeUp.displayName = 'FadeUp'
