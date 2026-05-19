import type { Point } from './dotGrid'

export interface EffectCtx {
  vw: number
  vh: number
  reduced: boolean
}

export interface EffectOutput {
  ox: number
  oy: number
  f: number
}

export interface Effect {
  name: string
  update(p: Point, i: number, t: number, ctx: EffectCtx): EffectOutput
}

const TAU = Math.PI * 2

function reducedScale(ctx: EffectCtx): number {
  return ctx.reduced ? 0.25 : 1
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

const ripplePulse: Effect = {
  name: 'ripple-pulse',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2
    const cy = ctx.vh / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const cycle = 3.0
    const speed = Math.max(ctx.vw, ctx.vh) / cycle * 0.6
    const phase = (t % cycle) * speed
    const sigma = 80
    const env = Math.exp(-((dist - phase) ** 2) / (2 * sigma * sigma))
    const safe = Math.max(dist, 0.001)
    const amp = 8 * reducedScale(ctx) * env
    const ux = dx / safe
    const uy = dy / safe
    return { ox: ux * amp, oy: uy * amp, f: env * 0.5 }
  },
}

const waveLR: Effect = {
  name: 'wave-lr',
  update(p, _i, t, ctx) {
    const lambda = 220
    const speed = 180
    const amp = 6 * reducedScale(ctx)
    const phase = (p.x - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    return { ox: 0, oy: s * amp, f: clamp01((s + 1) * 0.2) }
  },
}

const waveTB: Effect = {
  name: 'wave-tb',
  update(p, _i, t, ctx) {
    const lambda = 220
    const speed = 180
    const amp = 6 * reducedScale(ctx)
    const phase = (p.y - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    return { ox: s * amp, oy: 0, f: clamp01((s + 1) * 0.2) }
  },
}

const diagonalWave: Effect = {
  name: 'diagonal-wave',
  update(p, _i, t, ctx) {
    const lambda = 260
    const speed = 200
    const amp = 5 * reducedScale(ctx)
    const phase = (p.x + p.y - speed * t) / lambda * TAU
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    return { ox: s * amp, oy: c * amp, f: clamp01((s + 1) * 0.2) }
  },
}

function hash01(i: number): number {
  let x = (i + 1) * 374761393
  x = (x ^ (x >>> 15)) * 1103515245
  x = (x ^ (x >>> 13)) * 1597334677
  x = x ^ (x >>> 16)
  return ((x >>> 0) % 1000) / 1000
}

const twinkleStars: Effect = {
  name: 'twinkle',
  update(_p, i, t, _ctx) {
    const phase = hash01(i) * TAU
    const s = Math.sin(2 * t + phase)
    const peak = Math.max(0, s) ** 4
    return { ox: 0, oy: 0, f: peak * 0.6 }
  },
}

const heartbeat: Effect = {
  name: 'heartbeat',
  update(_p, _i, t, _ctx) {
    const cycle = 1.0
    const x = (t % cycle) / cycle
    let v = 0
    if (x < 0.12) v = Math.sin((x / 0.12) * Math.PI)
    else if (x < 0.18) v = 0
    else if (x < 0.30) v = Math.sin(((x - 0.18) / 0.12) * Math.PI) * 0.7
    return { ox: 0, oy: 0, f: v * 0.5 }
  },
}

const slowBreathing: Effect = {
  name: 'breathing',
  update(_p, _i, t, _ctx) {
    const v = (Math.sin((TAU * t) / 6) + 1) / 2
    return { ox: 0, oy: 0, f: v * 0.4 }
  },
}

export const EFFECTS: Effect[] = [
  ripplePulse,
  waveLR,
  waveTB,
  diagonalWave,
  twinkleStars,
  heartbeat,
  slowBreathing,
]

export function pickEffect(): number {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const fx = params.get('fx')
    if (fx !== null) {
      const n = parseInt(fx, 10)
      if (Number.isInteger(n) && n >= 0 && n < EFFECTS.length) return n
    }
  }
  return Math.floor(Math.random() * EFFECTS.length)
}
