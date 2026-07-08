import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrollToTop } from './ScrollToTop'

describe('ScrollToTop', () => {
  it('renders a button with accessible name', () => {
    render(<ScrollToTop />)
    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument()
  })

  it('starts hidden (opacity 0) and becomes visible after scroll', async () => {
    render(<ScrollToTop />)
    const motionDiv = document.querySelector('.fixed.bottom-6.right-6.z-40')
    expect(motionDiv).toHaveStyle({ opacity: '0' })

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { value: 800, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    // Wait for Motion animation to complete
    await new Promise((r) => setTimeout(r, 300))

    expect(motionDiv).toHaveStyle({ opacity: '1' })
  })

  it('clicking the button scrolls to top', async () => {
    const user = userEvent.setup()
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    // Scroll to make button visible
    Object.defineProperty(window, 'scrollY', { value: 800, writable: true })
    window.dispatchEvent(new Event('scroll'))

    render(<ScrollToTop />)

    await new Promise((r) => setTimeout(r, 100))

    // Use pointer events check skip since pointer-events: none during test
    await user.click(screen.getByRole('button', { name: /scroll to top/i }))

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
