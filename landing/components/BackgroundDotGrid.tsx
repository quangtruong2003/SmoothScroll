'use client'

import { useEffect, useRef } from 'react'

export function BackgroundDotGrid() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    if (reduced || noHover) {
      root.style.setProperty('--mx', '50%')
      root.style.setProperty('--my', '50%')
      return
    }

    let pendingX = 0
    let pendingY = 0
    let queued = false

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX
      pendingY = e.clientY
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        root.style.setProperty('--mx', pendingX + 'px')
        root.style.setProperty('--my', pendingY + 'px')
        queued = false
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="bg-dot-grid pointer-events-none fixed inset-0 -z-10"
    />
  )
}
