import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { LangSwitcher } from './LangSwitcher'

vi.mock('@/lib/i18n/provider', () => ({
  useLanguage: () => ({
    locale: 'en',
    setLocale: vi.fn(),
  }),
}))

describe('LangSwitcher', () => {
  it('renders trigger button with aria-expanded false initially', () => {
    render(<LangSwitcher />)
    const trigger = screen.getByRole('button', { name: /current language/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens menu on click (touch-friendly)', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes menu on second click', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher />)
    const trigger = screen.getByRole('button', { name: /current language/i })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('menu items have role=menuitem', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher />)
    await user.click(screen.getByRole('button', { name: /current language/i }))

    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(3)
  })
})
