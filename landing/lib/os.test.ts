import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectOS, getOSLabel } from './os'

describe('os.ts', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('returns win for Windows UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('win')
  })

  it('returns mac for macOS UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('mac')
  })

  it('returns linux for Linux UA (x86_64)', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('linux')
  })

  it('returns linux for Ubuntu UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('linux')
  })

  it('returns linux for Fedora UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('linux')
  })

  it('returns linux for Debian UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Debian; Linux x86_64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('linux')
  })

  it('returns other for unknown UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('other')
  })

  it('returns other on server side', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('navigator', undefined)
    expect(detectOS()).toBe('other')
  })

  describe('getOSLabel', () => {
    it('returns correct labels', () => {
      expect(getOSLabel('win')).toBe('Windows')
      expect(getOSLabel('mac')).toBe('macOS')
      expect(getOSLabel('linux')).toBe('Linux')
      expect(getOSLabel('other')).toBe('your OS')
    })
  })
})
