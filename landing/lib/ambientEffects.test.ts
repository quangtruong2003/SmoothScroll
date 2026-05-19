import { describe, it, expect } from 'vitest'
import { EFFECTS, pickEffect } from './ambientEffects'

const ctx = { vw: 1280, vh: 800, reduced: false }
const samplePoints = [
  { x: 0, y: 0 }, { x: 640, y: 400 }, { x: 1279, y: 799 },
  { x: 100, y: 100 }, { x: 1100, y: 700 },
]

describe('ambientEffects', () => {
  it('exports exactly 7 effects', () => {
    expect(EFFECTS).toHaveLength(7)
  })

  it('every effect has a name and update fn', () => {
    for (const e of EFFECTS) {
      expect(typeof e.name).toBe('string')
      expect(e.name.length).toBeGreaterThan(0)
      expect(typeof e.update).toBe('function')
    }
  })

  it('every effect returns finite numbers and bounded f for 100 frames', () => {
    for (const eff of EFFECTS) {
      for (let frame = 0; frame < 100; frame++) {
        const t = frame / 60
        for (let i = 0; i < samplePoints.length; i++) {
          const r = eff.update(samplePoints[i], i, t, ctx)
          expect(Number.isFinite(r.ox), `${eff.name} ox`).toBe(true)
          expect(Number.isFinite(r.oy), `${eff.name} oy`).toBe(true)
          expect(Number.isFinite(r.f), `${eff.name} f`).toBe(true)
          expect(r.f).toBeGreaterThanOrEqual(0)
          expect(r.f).toBeLessThanOrEqual(1)
          expect(Math.abs(r.ox)).toBeLessThanOrEqual(20)
          expect(Math.abs(r.oy)).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('reduced motion shrinks displacement on motion effects', () => {
    const p = { x: 200, y: 200 }
    for (const eff of EFFECTS) {
      let maxNormal = 0, maxReduced = 0
      for (let frame = 0; frame < 200; frame++) {
        const t = frame / 30
        const n = eff.update(p, 0, t, { vw: 1280, vh: 800, reduced: false })
        const r = eff.update(p, 0, t, { vw: 1280, vh: 800, reduced: true })
        maxNormal = Math.max(maxNormal, Math.abs(n.ox), Math.abs(n.oy))
        maxReduced = Math.max(maxReduced, Math.abs(r.ox), Math.abs(r.oy))
      }
      if (maxNormal > 0.5) {
        expect(maxReduced, `${eff.name} reduced`).toBeLessThanOrEqual(maxNormal * 0.5)
      }
    }
  })

  it('pickEffect returns a valid index in range', () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickEffect()
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(EFFECTS.length)
      expect(Number.isInteger(idx)).toBe(true)
    }
  })
})
