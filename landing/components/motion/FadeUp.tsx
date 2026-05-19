'use client'

import { motion } from 'motion/react'
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
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1] as const,
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
