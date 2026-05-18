'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SAMPLE_LINES = [
  '// SmoothScroll — natural scroll feel for Windows',
  '',
  'fn main() {',
  '    let settings = Settings::default()',
  '        .with_smoothing(0.85)',
  '        .with_easing(Easing::Natural)',
  '        .with_per_app_profiles(true);',
  '',
  '    SmoothScroll::init(settings)?;',
  '    Ok(())',
  '}',
  '',
  '// Default easing: cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  '// The same curve premium trackpads use.',
  '',
  '#[derive(Debug, Clone)]',
  'pub struct ScrollEvent {',
  '    pub delta: f64,',
  '    pub timestamp: u64,',
  '    pub source: InputSource,',
  '}',
  '',
  'impl ScrollInterpolator {',
  '    pub fn smooth(&self, event: ScrollEvent) -> f64 {',
  '        self.buffer.push(event.delta);',
  '        self.easing.interpolate(&self.buffer)',
  '    }',
  '}',
  '',
  '// Toggle the switch to feel the difference.',
]

const SMOOTH_EASING = 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
const NATIVE_EASING = 'auto'

interface DemoScrollProps {
  prompt: string
  toastMessage: string
}

export function DemoScroll({ prompt, toastMessage }: DemoScrollProps) {
  const [enabled, setEnabled] = useState(false)
  const [toggledOnce, setToggledOnce] = useState(false)
  const [scrolledAfterToggle, setScrolledAfterToggle] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  const handleToggle = () => {
    setEnabled((prev) => !prev)
    if (!toggledOnce) setToggledOnce(true)
    hasScrolledRef.current = false
    setScrolledAfterToggle(false)
  }

  const handleScroll = useCallback(() => {
    if (toggledOnce && !scrolledAfterToggle && hasScrolledRef.current) {
      setScrolledAfterToggle(true)
      if (!prefersReducedMotion) {
        toast(toastMessage, { duration: 4000 })
      }
    }
  }, [toggledOnce, scrolledAfterToggle, toastMessage, prefersReducedMotion])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const onWheel = () => {
      hasScrolledRef.current = true
      setTimeout(handleScroll, 100)
    }

    card.addEventListener('wheel', onWheel, { passive: true })
    return () => card.removeEventListener('wheel', onWheel)
  }, [handleScroll])

  return (
    <div className="flex flex-col items-center gap-4" ref={containerRef}>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className={cn('transition-colors', enabled && 'text-foreground font-medium')}>
          Native
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle smooth scroll"
        />
        <span className={cn('transition-colors', enabled ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          Smooth
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        ref={cardRef}
        className="w-full max-w-md h-[480px] rounded-xl border bg-card shadow-xl overflow-y-auto select-none"
        style={{ scrollBehavior: prefersReducedMotion ? 'auto' : (enabled ? SMOOTH_EASING : NATIVE_EASING) }}
        tabIndex={0}
        aria-label="Demo scroll card"
      >
        <div className="p-6">
          {SAMPLE_LINES.map((line, i) => (
            <div key={i} className={cn(
              'font-mono text-sm leading-7',
              line.startsWith('//') ? 'text-muted-foreground' : 'text-foreground',
              line === '' && 'h-4'
            )}>
              {line}
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground">{prompt}</p>
    </div>
  )
}
