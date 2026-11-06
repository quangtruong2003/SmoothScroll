import { describe, it, expect } from 'vitest'
import { BRANDS } from './brands'

describe('BRANDS', () => {
  it('has 16 entries', () => {
    expect(BRANDS).toHaveLength(16)
  })

  it('every brand src is local (starts with /assets/brand-icons/)', () => {
    for (const brand of BRANDS) {
      expect(brand.src).toMatch(/^\/assets\/brand-icons\/.+\.svg$/)
    }
  })

  it('no brand references the Iconify CDN', () => {
    for (const brand of BRANDS) {
      expect(brand.src).not.toContain('iconify.design')
    }
  })

  it('every brand has unique slug', () => {
    const slugs = BRANDS.map((b) => b.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
