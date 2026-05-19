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
const MAX_DOT_RADIUS = 1.8
const INFLUENCE_RADIUS = 200
const INNER_RADIUS = 120
const MAX_PUSH = 15
const MAX_PULL = 8
const CURSOR_LERP = 0.10
const DOT_LERP = 0.10
const INTENSITY_LERP = 0.08
const INTENSITY_THRESHOLD = 0.002
const F_THRESHOLD = 0.005
const SETTLE_THRESHOLD = 0.05
const STATIC_ALPHA = 0.1
const OFFSCREEN = -10000
const SPRITE_SIZE = 32
const SPRITE_HALF = SPRITE_SIZE / 2
const PIXEL_BUDGET = 6_000_000

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

function buildSprite(brand: Rgba): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = SPRITE_SIZE
  c.height = SPRITE_SIZE
  const sctx = c.getContext('2d')
  if (!sctx) return c
  const grad = sctx.createRadialGradient(
    SPRITE_HALF, SPRITE_HALF, 0,
    SPRITE_HALF, SPRITE_HALF, SPRITE_HALF,
  )
  grad.addColorStop(0,    `rgba(${brand.r},${brand.g},${brand.b},0.35)`)
  grad.addColorStop(0.25, `rgba(${brand.r},${brand.g},${brand.b},0.18)`)
  grad.addColorStop(0.6,  `rgba(${brand.r},${brand.g},${brand.b},0.04)`)
  grad.addColorStop(1,    `rgba(${brand.r},${brand.g},${brand.b},0)`)
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  return c
}

const CONTENT_TAGS = new Set([
  'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL',
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'IMG', 'CODE', 'PRE', 'LI', 'TABLE', 'TD', 'TH',
  'VIDEO', 'CANVAS', 'SVG', 'DETAILS', 'SUMMARY', 'SPAN',
])

function hasOpaqueBackground(el: Element): boolean {
  const cs = getComputedStyle(el)
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
  const bg = cs.backgroundColor
  if (!bg) return false
  if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false
  return true
}

function isOverContent(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) return false
  let n: Element | null = el
  while (n && n !== document.body && n !== document.documentElement) {
    if (CONTENT_TAGS.has(n.tagName)) return true
    if (hasOpaqueBackground(n)) return true
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
    const ambientDisabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('nofx')
    const activeEffect = ambientDisabled ? null : EFFECTS[pickEffect()]
    const startTime = performance.now()
    const effectCtx = { vw: 0, vh: 0, reduced }

    let grid: Point[] = []
    let dotState = new Float32Array(0)
    let viewW = 0
    let viewH = 0
    let dpr = 1
    let theme = readThemeColors()
    let sprite = buildSprite(theme.brandColor)

    let targetX = OFFSCREEN
    let targetY = OFFSCREEN
    let currentX = OFFSCREEN
    let currentY = OFFSCREEN
    let targetIntensity = 0
    let intensity = 0
    let rafId = 0
    let pendingX = OFFSCREEN
    let pendingY = OFFSCREEN
    let pendingDirty = false
    let pendingLeave = false

    function resize() {
      if (!canvas || !ctx) return
      viewW = window.innerWidth
      viewH = window.innerHeight
      const rawDpr = Math.min(window.devicePixelRatio || 1, 2)
      const wouldBe = viewW * viewH * rawDpr * rawDpr
      dpr = wouldBe > PIXEL_BUDGET && viewW * viewH > 0
        ? Math.max(1, Math.sqrt(PIXEL_BUDGET / (viewW * viewH)))
        : rawDpr
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
      const path = new Path2D()
      for (const p of grid) {
        path.moveTo(p.x + DOT_RADIUS, p.y)
        path.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
      }
      ctx.fill(path)
    }

    interface LitDot { x: number; y: number; f: number; radius: number; coreColor: Rgba }

    function drawFrame(): void {
      if (!ctx) return
      ctx.clearRect(0, 0, viewW, viewH)
      const staticStyle = rgbaToFillStyle(theme.staticColor)
      const staticPath = new Path2D()
      const lit: LitDot[] = []

      const t = (performance.now() - startTime) / 1000

      for (let i = 0; i < grid.length; i++) {
        const p = grid[i]
        const dx = p.x - currentX
        const dy = p.y - currentY
        const dist = Math.sqrt(dx * dx + dy * dy)

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

        const ambient = activeEffect
          ? activeEffect.update(p, i, t, effectCtx)
          : { ox: 0, oy: 0, f: 0 }
        const ox = dotState[idx]     + ambient.ox
        const oy = dotState[idx + 1] + ambient.oy
        const fMagnet = dotState[idx + 2]
        const fAmbient = Math.min(ambient.f, 0.2)
        const f = Math.max(fMagnet, fAmbient)

        const drawX = p.x + ox
        const drawY = p.y + oy

        if (f < F_THRESHOLD) {
          staticPath.moveTo(drawX + DOT_RADIUS, drawY)
          staticPath.arc(drawX, drawY, DOT_RADIUS, 0, Math.PI * 2)
          continue
        }

        const radius = DOT_RADIUS + (MAX_DOT_RADIUS - DOT_RADIUS) * f
        const coreColor = lerpRgba(theme.staticColor, theme.brandColor, f)
        lit.push({ x: drawX, y: drawY, f, radius, coreColor })
      }

      ctx.fillStyle = staticStyle
      ctx.fill(staticPath)

      for (const d of lit) {
        const spriteScale = 0.5 + d.f * 0.6
        const half = SPRITE_HALF * spriteScale
        ctx.globalAlpha = d.f
        ctx.drawImage(
          sprite,
          d.x - half,
          d.y - half,
          SPRITE_SIZE * spriteScale,
          SPRITE_SIZE * spriteScale,
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = rgbaToFillStyle(d.coreColor)
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function tick() {
      if (pendingLeave) {
        targetIntensity = 0
        pendingLeave = false
      }
      if (pendingDirty) {
        const overContent = isOverContent(pendingX, pendingY)
        targetX = pendingX
        targetY = pendingY
        if (currentX === OFFSCREEN) {
          currentX = targetX
          currentY = targetY
        }
        targetIntensity = overContent ? 0 : 1
        pendingDirty = false
      }
      currentX += (targetX - currentX) * CURSOR_LERP
      currentY += (targetY - currentY) * CURSOR_LERP
      intensity += (targetIntensity - intensity) * INTENSITY_LERP
      if (Math.abs(targetIntensity - intensity) < INTENSITY_THRESHOLD) {
        intensity = targetIntensity
      }
      drawFrame()
      rafId = requestAnimationFrame(tick)
    }

    function kick() {
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    function onMove(e: MouseEvent) {
      pendingX = e.clientX
      pendingY = e.clientY
      pendingDirty = true
      kick()
    }

    function onLeave() {
      pendingLeave = true
      kick()
    }

    function onResize() {
      resize()
      if (!animate || rafId === 0) drawStatic()
    }

    function onThemeChange() {
      theme = readThemeColors()
      sprite = buildSprite(theme.brandColor)
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
      className="pointer-events-none fixed inset-0 -z-10"
    />
  )
}
