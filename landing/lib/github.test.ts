import { describe, it, expect } from 'vitest'
import { formatDownloadCount, formatSize, sumReleaseDownloads } from './github'
import { buildDefaultUrl } from './useDownloadUrl'

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
      expect(formatSize(5000000)).toBe('5.0 MB')
    })
    it('formats GB', () => {
      expect(formatSize(1000000000)).toBe('1.0 GB')
    })
    it('formats KB', () => {
      expect(formatSize(500000)).toBe('500 KB')
    })
  })

  it('sums download counts across published releases and assets', () => {
    expect(sumReleaseDownloads([
      { tag_name: 'v1.0.0', assets: [{ name: 'setup.exe', browser_download_url: '', download_count: 12 }] },
      { tag_name: 'v1.1.0', assets: [
        { name: 'setup.exe', browser_download_url: '', download_count: 30 },
        { name: 'setup.exe.sig', browser_download_url: '', download_count: 4 },
      ] },
    ])).toBe(46)
  })

  it('builds valid installer or fallback URLs for release versions and latest', () => {
    expect(buildDefaultUrl('')).toEqual({
      url: 'https://github.com/quangtruong2003/SmoothScroll/releases/latest',
      filename: '',
    })
    expect(buildDefaultUrl('latest')).toEqual({
      url: 'https://github.com/quangtruong2003/SmoothScroll/releases/latest',
      filename: '',
    })
    expect(buildDefaultUrl('1.36.0')).toEqual({
      url: 'https://github.com/quangtruong2003/SmoothScroll/releases/download/v1.36.0/SmoothScroll_1.36.0_x64-setup.exe',
      filename: 'SmoothScroll_1.36.0_x64-setup.exe',
    })
  })
})
