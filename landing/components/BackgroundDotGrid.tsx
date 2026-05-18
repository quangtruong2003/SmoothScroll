'use client'

import { useEffect, useRef } from 'react'
import {
  buildGrid,
  falloff,
  lerpRgba,
  parseHslVar,
  type Point,
  type Rgba,
} from '@/lib/dotGrid'

const GAP = 22
const DOT_RADIUS = 1.0
const INFLUENCE_RADIUS = 220
const MAX_PUSH = 14
const LERP_FACTOR = 0.18
const SETTLE_THRESHOLD = 0.3
const STATIC_ALPHA = 0.14
const OFFSCREEN = -10000

interface ThemeColors {
  staticColor: Rgba
  brandColor: Rgba
}

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement)
  const fg = styles.getPropertyValue('--foreground').trim()
  const isDark =
    document.documentElement.classList.contains('dark') ||
    (!document.documentElement.classList.contains('light') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  const brandRaw = isDark ? '220 100% 78%' : styles.getPropertyValue('--brand-from').trim()
  return {
    staticColor: parseHslVar(fg, STATIC_ALPHA),
    brandColor: parseHslVar(brandRaw, 1),
  }
}

function rgbaToFillStyle(c: Rgba): string {
  return `rgba(${c.r},${c.g},${c.b},${c.a})`
}

export function BackgroundDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    const animate = !reduced && !noHover

    let grid: Point[] = []
    let viewW = 0
    let viewH = 0
    let dpr = 1
    let theme = readThemeColors()

    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let rafId = 0

    function resize() {
      if (!canvas || !ctx) return
      viewW = window.innerWidth
      viewH = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewW * dpr)
      canvas.height = Math.floor(viewH * dpr)
      canvas.style.width = `${viewW}px`
      canvas.style.height = `${viewH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      grid = buildGrid(viewW, viewH, GAP)
    }

    function drawStatic() {
      if (!ctx) return
      ctx.clearRect(0, 0, viewW, viewH)
      ctx.fillStyle = rgbaToFillStyle(theme.staticColor)
      for (const p of grid) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawFrame(): boolean {
      if (!ctx) return false
      ctx.clearRect(0, 0, viewW, viewH)
      const staticStyle = rgbaToFillStyle(theme.staticColor)
      let stillMoving = false

      for (const p of grid) {
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist >= INFLUENCE_RADIUS) {
          ctx.fillStyle = staticStyle
          ctx.beginPath()
          ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const f = falloff(dist, INFLUENCE_RADIUS)
        const safeDist = Math.max(dist, 0.001)
        const push = f * MAX_PUSH
        const drawX = p.x + (dx / safeDist) * push
        const drawY = p.y + (dy / safeDist) * push
        const color = lerpRgba(theme.staticColor, theme.brandColor, f)

        ctx.fillStyle = rgbaToFillStyle(color)
        ctx.beginPath()
        ctx.arc(drawX, drawY, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        if (push > SETTLE_THRESHOLD) stillMoving = true
      }

      return stillMoving
    }

    function tick() {
      currentX += (targetX - currentX) * LERP_FACTOR
      currentY += (targetY - currentY) * LERP_FACTOR
      const stillMoving = drawFrame()
      const cursorSettling =
        Math.abs(targetX - currentX) > SETTLE_THRESHOLD ||
        Math.abs(targetY - currentY) > SETTLE_THRESHOLD
      if (cursorSettling || stillMoving) {
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = 0
      }
    }

    function kick() {
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    function onMove(e: MouseEvent) {
      targetX = e.clientX
      targetY = e.clientY
      if (currentX === OFFSCREEN) {
        currentX = targetX
        currentY = targetY
      }
      kick()
    }

    function onLeave() {
      targetX = OFFSCREEN
      targetY = OFFSCREEN
      kick()
    }

    function onResize() {
      resize()
      if (!animate || rafId === 0) drawStatic()
    }

    function onThemeChange() {
      theme = readThemeColors()
      if (!animate || rafId === 0) drawStatic()
    }

    resize()
    drawStatic()

    if (animate) {
      window.addEventListener('mousemove', onMove, { passive: true })
      document.addEventListener('mouseleave', onLeave)
    }
    window.addEventListener('resize', onResize)

    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    colorSchemeQuery.addEventListener('change', onThemeChange)

    const observer = new MutationObserver(onThemeChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      if (animate) {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
      }
      window.removeEventListener('resize', onResize)
      colorSchemeQuery.removeEventListener('change', onThemeChange)
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  )
}
