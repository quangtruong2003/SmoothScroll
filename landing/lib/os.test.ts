import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectOS, getOSLabel } from './os'

describe('os.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns win for Windows UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('win')
    vi.stubGlobal('navigator', undefined as unknown)
  })

  it('returns mac for macOS UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('mac')
    vi.stubGlobal('navigator', undefined as unknown)
  })

  it('returns other for unknown UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('other')
    vi.stubGlobal('navigator', undefined as unknown)
  })

  it('returns other on server side', () => {
    vi.stubGlobal('navigator', undefined as unknown)
    expect(detectOS()).toBe('other')
  })

  describe('getOSLabel', () => {
    it('returns correct labels', () => {
      expect(getOSLabel('win')).toBe('Windows')
      expect(getOSLabel('mac')).toBe('macOS')
      expect(getOSLabel('other')).toBe('your OS')
    })
  })
})
