import { describe, it, expect } from 'vitest'
import { BRANDS } from './brands'

describe('brands', () => {
  it('exports exactly 16 entries', () => {
    expect(BRANDS).toHaveLength(16)
  })

  it('every entry has name, slug, hexLight, hexDark', () => {
    for (const b of BRANDS) {
      expect(b.name).toMatch(/.+/)
      expect(b.slug).toMatch(/^[a-z0-9]+$/)
      expect(b.hexLight).toMatch(/^#[0-9A-F]{6}$/i)
      expect(b.hexDark).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('slugs are unique', () => {
    const slugs = BRANDS.map((b) => b.slug)
    expect(new Set(slugs).size).toBe(BRANDS.length)
  })
})
