// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DemoScroll } from './DemoScroll'

const dict = {
  prompt: 'Scroll the card. Then flip the switch.',
  toastMessage: 'Want to feel it for real?',
}

describe('DemoScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the demo card', () => {
    render(<DemoScroll {...dict} />)
    expect(screen.getByLabelText('Demo scroll card')).toBeInTheDocument()
  })

  it('renders the switch', () => {
    render(<DemoScroll {...dict} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('toggles smooth scroll on switch change', async () => {
    render(<DemoScroll {...dict} />)
    const sw = screen.getByRole('switch')
    expect(sw).not.toBeChecked()
    await fireEvent.click(sw)
    expect(sw).toBeChecked()
  })
})
