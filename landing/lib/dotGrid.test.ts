import { describe, it, expect } from 'vitest'
import { parseHslVar, lerpRgba, falloff, buildGrid, type Rgba } from './dotGrid'

describe('parseHslVar', () => {
  it('parses standard "H S% L%" string', () => {
    expect(parseHslVar('220 90% 65%', 1)).toEqual({ r: 85, g: 139, b: 246, a: 1 })
  })

  it('applies provided alpha', () => {
    const c = parseHslVar('0 0% 0%', 0.14)
    expect(c.a).toBeCloseTo(0.14, 5)
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
  })

  it('falls back to neutral gray on malformed input', () => {
    expect(parseHslVar('not-a-color', 1)).toEqual({ r: 128, g: 128, b: 128, a: 1 })
  })
})

describe('lerpRgba', () => {
  const a: Rgba = { r: 0, g: 0, b: 0, a: 0.1 }
  const b: Rgba = { r: 255, g: 255, b: 255, a: 1 }

  it('returns first color when t=0', () => {
    expect(lerpRgba(a, b, 0)).toEqual(a)
  })

  it('returns second color when t=1', () => {
    expect(lerpRgba(a, b, 1)).toEqual(b)
  })

  it('mixes channels at t=0.5', () => {
    const m = lerpRgba(a, b, 0.5)
    expect(m.r).toBe(128)
    expect(m.a).toBeCloseTo(0.55, 5)
  })
})

describe('falloff', () => {
  it('returns 0 at or beyond radius', () => {
    expect(falloff(220, 220)).toBe(0)
    expect(falloff(500, 220)).toBe(0)
  })

  it('returns 1 at distance 0', () => {
    expect(falloff(0, 220)).toBe(1)
  })

  it('is quadratic: half-distance gives 0.25', () => {
    expect(falloff(110, 220)).toBeCloseTo(0.25, 5)
  })
})

describe('buildGrid', () => {
  it('covers viewport with one-cell margin on every side', () => {
    const grid = buildGrid(44, 44, 22)
    expect(grid.length).toBe(25)
    expect(grid[0]).toEqual({ x: -22, y: -22 })
  })

  it('handles non-multiple viewport sizes', () => {
    const grid = buildGrid(50, 50, 22)
    expect(grid.length).toBe(25)
  })
})
