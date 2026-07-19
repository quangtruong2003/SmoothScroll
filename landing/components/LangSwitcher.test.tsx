import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LangSwitcher } from './LangSwitcher'

vi.mock('@/lib/i18n/provider', () => ({
  STORAGE_KEY: 'smoothscroll-locale',
  useLanguage: () => ({ locale: 'en' }),
}))

describe('LangSwitcher', () => {
  it('renders a collapsed native disclosure', () => {
    const { container } = render(<LangSwitcher pageKind="home" />)
    expect(container.querySelector('details')).not.toHaveAttribute('open')
  })

  it('keeps localized links mounted while closed', () => {
    render(<LangSwitcher pageKind="home" />)
    expect(screen.getAllByRole('link', { hidden: true }).map((item) => item.getAttribute('href'))).toEqual(['/', '/vi', '/zh'])
  })

  it('opens localized links through the native disclosure', async () => {
    const user = userEvent.setup()
    render(<LangSwitcher pageKind="home" />)
    await user.click(screen.getByText('EN'))

    expect(screen.getAllByRole('link').map((item) => item.getAttribute('href'))).toEqual(['/', '/vi', '/zh'])
  })

  it('keeps guide language links on guide routes', () => {
    render(<LangSwitcher pageKind="how-it-works" />)

    expect(screen.getAllByRole('link', { hidden: true }).map((item) => item.getAttribute('href'))).toEqual([
      '/how-it-works',
      '/vi/how-it-works',
      '/zh/how-it-works',
    ])
  })
})
