import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Footer } from './Footer'

vi.mock('@/lib/i18n/provider', async () => {
  const en = (await import('@/lib/i18n/en.json')).default
  return {
    STORAGE_KEY: 'smoothscroll-locale',
    useLanguage: vi.fn(() => ({ locale: 'en', dict: en })),
  }
})

vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }))

// A test below swaps the shared mock to vi, so pin the default after every test
// and keep the suite independent of declaration order.
afterEach(async () => {
  const en = (await import('@/lib/i18n/en.json')).default
  const { useLanguage } = await import('@/lib/i18n/provider')
  vi.mocked(useLanguage).mockReturnValue({ locale: 'en', dict: en } as never)
})

describe('Footer', () => {
  it('renders link columns, guide links, and the copyright line', () => {
    render(<Footer />)

    expect(screen.getByRole('heading', { name: 'Product' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Guides' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/how-it-works')
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/#install')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(screen.getByRole('link', { name: 'Mac-like scrolling on Windows' })).toHaveAttribute(
      'href',
      '/mac-like-scrolling-windows',
    )
    expect(screen.getByRole('link', { name: 'Report an issue on GitHub (opens new tab)' })).toHaveAttribute(
      'href',
      'https://github.com/quangtruong2003/SmoothScroll/issues',
    )

    expect(screen.getByText(/© 2026 SmoothScroll/)).toBeInTheDocument()
  })

  it('localizes product links for non-default locales', async () => {
    const { useLanguage } = await import('@/lib/i18n/provider')
    const viDict = (await import('@/lib/i18n/vi.json')).default
    vi.mocked(useLanguage).mockReturnValue({ locale: 'vi', dict: viDict } as never)

    render(<Footer pageKind="faq" />)

    expect(screen.getByRole('heading', { name: 'Sản phẩm' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cách hoạt động' })).toHaveAttribute('href', '/vi/how-it-works')
    expect(screen.getByRole('link', { name: 'Quyền riêng tư' })).toHaveAttribute('href', '/vi/privacy')
  })
})
