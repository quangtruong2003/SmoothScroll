'use client'

import { useEffect, useRef } from 'react'

export function BackgroundDotGrid() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    if (reduced || noHover) return

    let targetX = -1000
    let targetY = -1000
    let currentX = -1000
    let currentY = -1000
    let rafId = 0
    let hasMoved = false

    const tick = () => {
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18
      root.style.setProperty('--mx', currentX + 'px')
      root.style.setProperty('--my', currentY + 'px')

      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = 0
      }
    }

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY
      if (!hasMoved) {
        // First move: jump to cursor instead of springing in from off-screen
        currentX = targetX
        currentY = targetY
        hasMoved = true
      }
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    const onLeave = () => {
      // Park the spotlight off-screen so it doesn't linger when the cursor leaves
      targetX = -1000
      targetY = -1000
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="bg-dot-grid pointer-events-none fixed inset-0 -z-10"
    />
  )
}