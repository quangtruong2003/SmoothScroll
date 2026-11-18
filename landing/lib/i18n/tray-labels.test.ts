import { describe, it, expect } from 'vitest'
import { getTrayLabels } from './tray-labels'

describe('tray-labels', () => {
  it('returns English labels matching the Windows app when locale="en"', () => {
    const labels = getTrayLabels('en')
    expect(labels.smooth_scrolling).toBe('Smooth Scrolling')
    expect(labels.status_on).toBe('ON')
    expect(labels.status_off).toBe('OFF')
    expect(labels.quit).toBe('Quit SmoothScroll')
  })

  it('returns Vietnamese labels matching the Windows app when locale="vi"', () => {
    const labels = getTrayLabels('vi')
    expect(labels.smooth_scrolling).toBe('Cuộn mượt')
    expect(labels.status_on).toBe('BẬT')
    expect(labels.quit).toBe('Thoát SmoothScroll')
  })

  it('returns Chinese labels matching the Windows app when locale="zh"', () => {
    const labels = getTrayLabels('zh')
    expect(labels.smooth_scrolling).toBe('平滑滚动')
    expect(labels.status_on).toBe('开')
    expect(labels.quit).toBe('退出 SmoothScroll')
  })

  it('all locales share the same key set', () => {
    const en = Object.keys(getTrayLabels('en')).sort()
    const vi = Object.keys(getTrayLabels('vi')).sort()
    const zh = Object.keys(getTrayLabels('zh')).sort()
    expect(vi).toEqual(en)
    expect(zh).toEqual(en)
  })
})
