import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackgroundDotGrid } from '@/components/BackgroundDotGrid'

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getContext: vi.fn(),
  })) as any

  // Mock Path2D for jsdom
  class MockPath2D {
    moveTo = vi.fn()
    arc = vi.fn()
    addPath = vi.fn()
  }
  vi.stubGlobal('Path2D', MockPath2D)
})

describe('BackgroundDotGrid reduced-motion', () => {
  it('does not start animation loop when prefers-reduced-motion: reduce', async () => {
    const matchMediaMock = vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0 as any)

    render(<BackgroundDotGrid />)

    await new Promise((r) => setTimeout(r, 0))

    expect(rafSpy).not.toHaveBeenCalled()
    rafSpy.mockRestore()
  })
})
