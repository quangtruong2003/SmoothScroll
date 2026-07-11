import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogoWall } from './LogoWall'
import { BRANDS } from '@/lib/brands'

describe('LogoWall', () => {
  it('renders all 16 unique brands across both segments', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    const uniqueNames = new Set(cells.map((c) => c.getAttribute('aria-label')))
    expect(uniqueNames.size).toBe(BRANDS.length)
    expect(uniqueNames.size).toBe(16)
  })

  it('exposes a marquee track element', () => {
    const { container } = render(<LogoWall />)
    const track = container.querySelector('.marquee-track')
    expect(track).not.toBeNull()
  })

  it('applies edge-fade mask to the region', () => {
    render(<LogoWall />)
    const region = screen.getByRole('region')
    expect(region.className).toContain('mask-fade')
  })

  it('marks exactly one segment aria-hidden to avoid double-read', () => {
    const { container } = render(<LogoWall />)
    const lists = container.querySelectorAll('ul[role="list"]')
    expect(lists.length).toBe(2)
    const hidden = Array.from(lists).filter(
      (l) => l.getAttribute('aria-hidden') === 'true'
    )
    expect(hidden.length).toBe(1)
  })

  it('every cell has an accessible name from a brand', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    const brandNames = BRANDS.map((b) => b.name)
    for (const cell of cells) {
      expect(brandNames).toContain(cell.getAttribute('aria-label'))
    }
  })
})