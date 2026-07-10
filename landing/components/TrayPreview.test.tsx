import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TrayPreview } from './TrayPreview'

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
