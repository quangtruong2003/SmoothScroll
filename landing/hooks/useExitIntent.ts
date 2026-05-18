'use client'

import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'ss-exit-intent-fired'
const SCROLL_TRIGGER_RATIO = 0.85
const IDLE_TIMEOUT_MS = 60_000

export function useExitIntent(): boolean {
  const [triggered, setTriggered] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return

    const fire = () => {
      if (firedRef.current) return
      firedRef.current = true
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      setTriggered(true)
    }

    // Desktop: cursor leaves the top of the viewport
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire()
    }

    // Mobile/touch: scroll past 85% of the page
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight
      const scrolledTo = window.scrollY + window.innerHeight
      if (scrolledTo / docHeight >= SCROLL_TRIGGER_RATIO) fire()
    }

    // Mobile: history popstate (back button) — proxy for "leaving the page"
    const onPopState = () => fire()

    // Both: idle for 60s on the page (covers tab-switching reading patterns)
    const idleTimer = window.setTimeout(fire, IDLE_TIMEOUT_MS)

    document.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
      window.clearTimeout(idleTimer)
    }
  }, [])

  return triggered
}
