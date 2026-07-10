import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
