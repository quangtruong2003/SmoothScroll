'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'

interface StickyDownloadBarProps {
  ctaLabel: string
  fallbackCta: string
}

export function StickyDownloadBar({ ctaLabel, fallbackCta }: StickyDownloadBarProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { url, filename } = useDownloadUrl()

  useEffect(() => {
    const onScroll = () => {
      const heroBottom = window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      const scrolledTo = window.scrollY + window.innerHeight
      const nearBottom = scrolledTo >= docHeight - 240
      const past = window.scrollY > heroBottom

      setVisible(past && !nearBottom && !dismissed)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [dismissed])

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/90 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3"
          role="complementary"
          aria-label="Download bar"
        >
          <div className="container flex items-center justify-between gap-4">
            <p className="text-sm font-medium hidden sm:block">
              Ready to feel the difference?
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="text-muted-foreground"
              >
                ✕
              </Button>
              <Button
                variant="brand"
                size="sm"
                asChild
              >
                <a href={url} rel="noopener noreferrer" download={filename || undefined}>
                  <Download className="h-4 w-4 mr-1.5" />
                  {ctaLabel || fallbackCta}
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
