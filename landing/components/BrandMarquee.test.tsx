import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BrandMarquee } from './BrandMarquee'
import { BRANDS } from '@/lib/brands'

describe('BrandMarquee', () => {
  it('renders every brand twice (16 × 2 = 32 items)', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    expect(items.length).toBe(BRANDS.length * 2)
  })

  it('first copy is announced to screen readers, second is aria-hidden', () => {
    const { container } = render(<BrandMarquee />)
    const copies = container.querySelectorAll('[data-brand-copy]')
    expect(copies.length).toBe(2)
    expect(copies[0].getAttribute('aria-hidden')).toBeNull()
    expect(copies[1].getAttribute('aria-hidden')).toBe('true')
  })

  it('every item has aria-label with brand name', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    for (const el of Array.from(items)) {
      const label = el.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(BRANDS.map((b) => b.name)).toContain(label)
    }
  })

  it('every item contains two img tags (light + dark)', () => {
    const { container } = render(<BrandMarquee />)
    const items = container.querySelectorAll('[data-brand-item]')
    for (const el of Array.from(items)) {
      const imgs = el.querySelectorAll('img')
      expect(imgs.length).toBe(2)
    }
  })

  it('renders the marquee track with the animation class', () => {
    const { container } = render(<BrandMarquee />)
    const track = container.querySelector('.brand-marquee-track')
    expect(track).not.toBeNull()
  })
})
