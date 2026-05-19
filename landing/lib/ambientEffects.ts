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

const floatingDrift: Effect = {
  name: 'drift',
  update(p, _i, t, ctx) {
    const amp = 4 * reducedScale(ctx)
    const ox = Math.sin(p.x * 0.012 + 0.3 * t) * amp
    const oy = Math.cos(p.y * 0.012 + 0.4 * t + 0.7) * amp
    return { ox, oy, f: 0.15 }
  },
}

const COMET_RADIUS = 180
const wanderingComet: Effect = {
  name: 'comet',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2 + Math.sin(t * 0.41) * (ctx.vw * 0.4)
    const cy = ctx.vh / 2 + Math.sin(t * 0.27 + 1.3) * (ctx.vh * 0.4)
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= COMET_RADIUS) return { ox: 0, oy: 0, f: 0 }
    const k = 1 - dist / COMET_RADIUS
    const safe = Math.max(dist, 0.001)
    const pull = k * 3 * reducedScale(ctx)
    return { ox: -(dx / safe) * pull, oy: -(dy / safe) * pull, f: k * 0.7 }
  },
}

const galaxySpin: Effect = {
  name: 'galaxy',
  update(p, _i, t, ctx) {
    const cx = ctx.vw / 2
    const cy = ctx.vh / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r < 1) return { ox: 0, oy: 0, f: 0.05 }
    const omega = 0.6
    const phase = omega * t - r * 0.012
    const amp = 6 * reducedScale(ctx)
    const offset = Math.sin(phase) * amp
    const tx = -dy / r
    const ty = dx / r
    return { ox: tx * offset, oy: ty * offset, f: 0.2 }
  },
}

export const EFFECTS: Effect[] = [
  ripplePulse,
  waveLR,
  waveTB,
  diagonalWave,
  floatingDrift,
  wanderingComet,
  galaxySpin,
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
