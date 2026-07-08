import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogoWall } from './LogoWall'
import { BRANDS } from '@/lib/brands'

describe('LogoWall', () => {
  it('renders all 16 brand cells', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    expect(cells).toHaveLength(BRANDS.length)
    expect(cells).toHaveLength(16)
  })

  it('has no animation classes on the wrapper', () => {
    render(<LogoWall />)
    const wrapper = screen.getByRole('region')
    expect(wrapper.className).not.toContain('animate-')
    expect(wrapper.className).not.toContain('marquee')
  })

  it('every cell has an accessible name from a brand', () => {
    render(<LogoWall />)
    const cells = screen.getAllByRole('listitem')
    const brandNames = BRANDS.map((b) => b.name)
    for (const cell of cells) {
      expect(brandNames).toContain(cell.getAttribute('aria-label'))
    }
  })

  it('uses a static grid layout (no marquee classes)', () => {
    const { container } = render(<LogoWall />)
    const grid = container.querySelector('ul')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toContain('grid-cols-2')
  })
})
