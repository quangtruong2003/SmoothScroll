'use client'

import { useState, useRef, useEffect } from 'react'
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

interface DemoScrollProps {
  prompt: string
  toastMessage: string
}

const STEP_PX = 120
const DURATION_MS = 360

const easeOutExpo = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)

export function DemoScroll({ prompt, toastMessage }: DemoScrollProps) {
  const [enabled, setEnabled] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const enabledRef = useRef(enabled)
  const reducedMotionRef = useRef<boolean>(!!prefersReducedMotion)
  const toggledOnceRef = useRef(false)
  const scrolledAfterToggleRef = useRef(false)

  const animFromRef = useRef(0)
  const animToRef = useRef(0)
  const animStartRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    enabledRef.current = enabled
    const card = cardRef.current
    if (card) {
      animFromRef.current = card.scrollTop
      animToRef.current = card.scrollTop
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    scrolledAfterToggleRef.current = false
  }, [enabled])

  useEffect(() => {
    reducedMotionRef.current = !!prefersReducedMotion
  }, [prefersReducedMotion])

  const handleToggle = () => {
    setEnabled((prev) => !prev)
    toggledOnceRef.current = true
  }

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const tick = () => {
      const card = cardRef.current
      if (!card) {
        rafRef.current = null
        return
      }
      const now = performance.now()
      const t = Math.min(1, (now - animStartRef.current) / DURATION_MS)
      const eased = easeOutExpo(t)
      card.scrollTop =
        animFromRef.current +
        (animToRef.current - animFromRef.current) * eased
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        animFromRef.current = animToRef.current
        rafRef.current = null
      }
    }

    const notifyScrolled = () => {
      if (toggledOnceRef.current && !scrolledAfterToggleRef.current) {
        scrolledAfterToggleRef.current = true
        if (!reducedMotionRef.current) {
          toast(toastMessage, { duration: 4000 })
        }
      }
    }

    const onWheel = (event: WheelEvent) => {
      const card = cardRef.current
      if (!card) return

      const max = card.scrollHeight - card.clientHeight
      const direction = event.deltaY > 0 ? 1 : -1
      const atTop = card.scrollTop <= 0 && direction < 0
      const atBottom = card.scrollTop >= max - 1 && direction > 0
      if (atTop || atBottom) return

      event.preventDefault()
      notifyScrolled()

      const useSmooth = enabledRef.current && !reducedMotionRef.current
      if (useSmooth) {
        animFromRef.current = card.scrollTop
        animToRef.current = Math.max(
          0,
          Math.min(max, animToRef.current + direction * STEP_PX),
        )
        animStartRef.current = performance.now()
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(tick)
        }
      } else {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        card.scrollTop = Math.max(
          0,
          Math.min(max, card.scrollTop + direction * STEP_PX),
        )
        animFromRef.current = card.scrollTop
        animToRef.current = card.scrollTop
      }
    }

    card.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      card.removeEventListener('wheel', onWheel)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [toastMessage])

  return (
    <div className="flex flex-col items-center gap-4">
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
        style={{ scrollBehavior: 'auto', overscrollBehavior: 'contain' }}
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
