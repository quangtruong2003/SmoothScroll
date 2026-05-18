'use client'

import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'ss-exit-intent-fired'

export function useExitIntent(): boolean {
  const [triggered, setTriggered] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0 && !firedRef.current) {
        firedRef.current = true
        sessionStorage.setItem(SESSION_KEY, '1')
        setTriggered(true)
      }
    }

    document.addEventListener('mouseleave', onMouseLeave)
    return () => document.removeEventListener('mouseleave', onMouseLeave)
  }, [])

  return triggered
}
