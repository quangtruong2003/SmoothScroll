'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScrollToTop() {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 500)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-40"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.8 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <Button
        variant="default"
        size="icon"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="h-10 w-10 rounded-full shadow-lg"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </motion.div>
  )
}
