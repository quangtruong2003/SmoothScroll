'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'

interface LegacyMediaQueryList extends MediaQueryList {
  addListener: (listener: (event: MediaQueryListEvent) => void) => void
  removeListener: (listener: (event: MediaQueryListEvent) => void) => void
}

interface ScrollSceneProps {
  children: React.ReactNode
  className?: string
  scene: 'pin' | 'stack'
}

export function ScrollScene({ children, className, scene }: ScrollSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    gsap.registerPlugin(ScrollTrigger)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const legacyMedia = media as LegacyMediaQueryList
    let context: gsap.Context | undefined

    const setup = () => {
      context?.revert()
      context = undefined

      if (media.matches) return

      context = gsap.context(() => {
        const selector = scene === 'pin' ? '[data-scene-pin]' : '[data-stack-card]'
        root.querySelectorAll(selector).forEach((target) => {
          ScrollTrigger.create({ trigger: target, pin: target })
        })
      }, root)
    }

    setup()
    if ('addEventListener' in media) {
      media.addEventListener('change', setup)
    } else {
      legacyMedia.addListener(setup)
    }

    return () => {
      if ('removeEventListener' in media) {
        media.removeEventListener('change', setup)
      } else {
        legacyMedia.removeListener(setup)
      }
      context?.revert()
    }
  }, [scene])

  return (
    <div ref={rootRef} className={className} data-scene={scene}>
      {children}
    </div>
  )
}
