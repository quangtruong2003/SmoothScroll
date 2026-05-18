export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Point {
  x: number
  y: number
}

const NEUTRAL: Rgba = { r: 128, g: 128, b: 128, a: 1 }

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100
  const lNorm = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) =>
    lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

export function parseHslVar(value: string, alpha: number): Rgba {
  const match = value
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/)
  if (!match) return { ...NEUTRAL, a: alpha }
  const h = Number(match[1])
  const s = Number(match[2])
  const l = Number(match[3])
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) {
    return { ...NEUTRAL, a: alpha }
  }
  const { r, g, b } = hslToRgb(h, s, l)
  return { r, g, b, a: alpha }
}

export function lerpRgba(a: Rgba, b: Rgba, t: number): Rgba {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: a.a + (b.a - a.a) * t,
  }
}

export function falloff(distance: number, radius: number): number {
  if (distance >= radius) return 0
  const t = 1 - distance / radius
  return t * t
}

export function buildGrid(width: number, height: number, gap: number): Point[] {
  const points: Point[] = []
  for (let y = -gap; y <= height + gap; y += gap) {
    for (let x = -gap; x <= width + gap; x += gap) {
      points.push({ x, y })
    }
  }
  return points
}
