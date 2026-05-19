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
import { EFFECTS, pickEffect } from '@/lib/ambientEffects'

const GAP = 22
const DOT_RADIUS = 1.0
const MAX_DOT_RADIUS = 2.6
const INFLUENCE_RADIUS = 200
const INNER_RADIUS = 120
const MAX_PUSH = 15
const MAX_PULL = 8
const MAX_SHADOW_BLUR = 10
const CURSOR_LERP = 0.10
const DOT_LERP = 0.10
const INTENSITY_LERP = 0.08
const INTENSITY_THRESHOLD = 0.002
const F_THRESHOLD = 0.005
const SETTLE_THRESHOLD = 0.05
const STATIC_ALPHA = 0.1
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

const CONTENT_TAGS = new Set([
  'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL',
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'IMG', 'CODE', 'PRE', 'LI', 'TABLE', 'TD', 'TH',
  'VIDEO', 'CANVAS', 'SVG', 'DETAILS', 'SUMMARY', 'SPAN',
])

function isOverContent(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) return false
  let n: Element | null = el
  while (n && n !== document.body) {
    if (CONTENT_TAGS.has(n.tagName)) return true
    n = n.parentElement
  }
  return false
}

export function BackgroundDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const noHover = window.matchMedia('(hover: none)').matches
    const animate = !noHover
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const activeEffect = EFFECTS[pickEffect()]
    const startTime = performance.now()
    const effectCtx = { vw: 0, vh: 0, reduced }

    let grid: Point[] = []
    // Per-dot state, packed as [ox, oy, f, ox, oy, f, ...].
    let dotState = new Float32Array(0)
    let viewW = 0
    let viewH = 0
    let dpr = 1
    let theme = readThemeColors()

    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let targetIntensity = 0
    let intensity = 0
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
      dotState = new Float32Array(grid.length * 3)
      effectCtx.vw = viewW
      effectCtx.vh = viewH
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
      const brand = theme.brandColor
      const shadowColor = `rgba(${brand.r},${brand.g},${brand.b},0.9)`
      let stillMoving = false
      let shadowOn = false

      ctx.fillStyle = staticStyle
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      const t = (performance.now() - startTime) / 1000

      for (let i = 0; i < grid.length; i++) {
        const p = grid[i]
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Magnet target offset and lit factor.
        let tOffX = 0
        let tOffY = 0
        let tF = 0
        if (intensity > INTENSITY_THRESHOLD && dist < INFLUENCE_RADIUS) {
          tF = falloff(dist, INFLUENCE_RADIUS) * intensity
          const safeDist = Math.max(dist, 0.001)
          if (dist < INNER_RADIUS) {
            const pushT = (1 - dist / INNER_RADIUS) * intensity
            const disp = pushT * MAX_PUSH
            tOffX = (dx / safeDist) * disp
            tOffY = (dy / safeDist) * disp
          } else {
            const disp = tF * MAX_PULL
            tOffX = -(dx / safeDist) * disp
            tOffY = -(dy / safeDist) * disp
          }
        }

        const idx = i * 3
        dotState[idx]     += (tOffX - dotState[idx])     * DOT_LERP
        dotState[idx + 1] += (tOffY - dotState[idx + 1]) * DOT_LERP
        dotState[idx + 2] += (tF    - dotState[idx + 2]) * DOT_LERP

        const ambient = activeEffect.update(p, i, t, effectCtx)
        const ox = dotState[idx]     + ambient.ox
        const oy = dotState[idx + 1] + ambient.oy
        const fMagnet = dotState[idx + 2]
        const f = Math.max(fMagnet, ambient.f)

        if (
          Math.abs(tOffX - dotState[idx]) > SETTLE_THRESHOLD ||
          Math.abs(tOffY - dotState[idx + 1]) > SETTLE_THRESHOLD ||
          Math.abs(tF - fMagnet) > F_THRESHOLD
        ) {
          stillMoving = true
        }

        if (f < F_THRESHOLD) {
          if (shadowOn) {
            ctx.shadowBlur = 0
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = staticStyle
            shadowOn = false
          }
          ctx.beginPath()
          ctx.arc(p.x + ox, p.y + oy, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        const color = lerpRgba(theme.staticColor, theme.brandColor, f)
        ctx.shadowBlur = MAX_SHADOW_BLUR * f
        ctx.shadowColor = shadowColor
        ctx.fillStyle = rgbaToFillStyle(color)
        shadowOn = true

        ctx.beginPath()
        ctx.arc(p.x + ox, p.y + oy, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      if (shadowOn) {
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
      }

      return stillMoving
    }

    function tick() {
      currentX += (targetX - currentX) * CURSOR_LERP
      currentY += (targetY - currentY) * CURSOR_LERP
      intensity += (targetIntensity - intensity) * INTENSITY_LERP
      if (Math.abs(targetIntensity - intensity) < INTENSITY_THRESHOLD) {
        intensity = targetIntensity
      }
      drawFrame()
      // Ambient is always animating; never park rAF.
      rafId = requestAnimationFrame(tick)
    }

    function kick() {
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    function onMove(e: MouseEvent) {
      const overContent = isOverContent(e.clientX, e.clientY)
      targetX = e.clientX
      targetY = e.clientY
      if (currentX === OFFSCREEN) {
        currentX = targetX
        currentY = targetY
      }
      targetIntensity = overContent ? 0 : 1
      kick()
    }

    function onLeave() {
      targetIntensity = 0
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
    kick()

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
      className="pointer-events-none fixed inset-0 z-50"
    />
  )
}
