import { describe, it, expect } from 'vitest'
import { formatDownloadCount, formatSize } from './github'

describe('github.ts', () => {
  describe('formatDownloadCount', () => {
    it('formats thousands', () => {
      expect(formatDownloadCount(12000)).toBe('12.0k')
    })
    it('formats millions', () => {
      expect(formatDownloadCount(1500000)).toBe('1.5M')
    })
    it('formats small numbers', () => {
      expect(formatDownloadCount(999)).toBe('999')
    })
  })

  describe('formatSize', () => {
    it('formats MB', () => {
      expect(formatSize(5242880)).toBe('5.0 MB')
    })
    it('formats GB', () => {
      expect(formatSize(1073741824)).toBe('1.0 GB')
    })
    it('formats KB', () => {
      expect(formatSize(512000)).toBe('500 KB')
    })
  })
})
