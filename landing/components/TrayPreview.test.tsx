import { describe, it, expect, vi } from 'vitest'

vi.mock('./motion/FadeUp', () => ({
  FadeUp: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
}))

import { render, screen, fireEvent, act } from '@testing-library/react'
import { TrayPreview } from './TrayPreview'
import { TrayPreviewSection } from './sections/TrayPreviewSection'
import { LanguageProvider } from '@/lib/i18n/provider'

describe('TrayPreview — static shell', () => {
  it('renders the SmoothScroll header in default ON state', () => {
    render(<TrayPreview locale="en" />)
    expect(screen.getByText('SmoothScroll')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })

  it('renders CurrentAppCard with hardcoded Chrome name', () => {
    render(<TrayPreview locale="en" />)
    expect(screen.getByText('Chrome')).toBeInTheDocument()
  })

  it('uses Vietnamese labels when locale="vi"', () => {
    render(<TrayPreview locale="vi" />)
    expect(screen.getByText('Cuộn mượt')).toBeInTheDocument()
    expect(screen.getByText('Bật')).toBeInTheDocument()
  })

  it('uses Chinese labels when locale="zh"', () => {
    render(<TrayPreview locale="zh" />)
    expect(screen.getByText('平滑滚动')).toBeInTheDocument()
    expect(screen.getByText('已启用')).toBeInTheDocument()
  })
})

describe('TrayPreviewSection — primary tray only', () => {
  it('renders one live tray without decorative stack cards', () => {
    render(
      <LanguageProvider>
        <TrayPreviewSection dict={{ trayPreview: { title: 'Tray', subtitle: 'Preview' } }} />
      </LanguageProvider>,
    )

    expect(document.querySelector('[data-scene="stack"]')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-stack-card]')).toHaveLength(0)
    expect(screen.getAllByTestId('tray-preview')).toHaveLength(1)
    expect(screen.getByText('Open Settings').closest('button')).toBeInTheDocument()
    expect(screen.getByText('Quit').closest('button')).toBeInTheDocument()
  })
})

describe('TrayPreview — Smooth Scrolling toggle', () => {
  it('flips status dot OFF when Smooth Scrolling toggled off', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Smooth Scrolling')
    fireEvent.click(switchEl)
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('flips status dot back ON when toggled on again', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Smooth Scrolling')
    fireEvent.click(switchEl)
    fireEvent.click(switchEl)
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})

describe('TrayPreview — Start with Windows independence', () => {
  it('toggling Start with Windows does NOT affect status dot', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Start with Windows')
    fireEvent.click(switchEl)
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(switchEl).not.toBeChecked()
  })
})

describe('TrayPreview — Open Settings bounce', () => {
  it('clicking Open Settings adds a transient pulse class', () => {
    render(<TrayPreview locale="en" />)
    const settingsRow = screen.getByText('Open Settings').closest('.tray-row')!
    fireEvent.click(settingsRow)
    expect(settingsRow.className).toMatch(/tray-row-pulse/)
  })

  it('pulse class clears after 300ms', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    const settingsRow = screen.getByText('Open Settings').closest('.tray-row')!
    fireEvent.click(settingsRow)
    expect(settingsRow.className).toMatch(/tray-row-pulse/)
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(settingsRow.className).not.toMatch(/tray-row-pulse/)
    vi.useRealTimers()
  })
})

describe('TrayPreview — Quit state machine', () => {
  it('clicking Quit transitions to quitting state', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    expect(screen.getByTestId('tray-preview').className).toMatch(/tray-quitting/)
  })

  it('both Switches animate OFF in quitting state', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    expect(screen.getByLabelText('Smooth Scrolling')).not.toBeChecked()
    expect(screen.getByLabelText('Start with Windows')).not.toBeChecked()
  })

  it('after 5s, transitions to closed state and shows reopen button', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Click to reopen')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('clicking reopen resets state to running with both toggles ON', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    fireEvent.click(screen.getByText('Click to reopen'))
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByLabelText('Smooth Scrolling')).toBeChecked()
    expect(screen.getByLabelText('Start with Windows')).toBeChecked()
    vi.useRealTimers()
  })
})
