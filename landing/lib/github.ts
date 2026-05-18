export interface ReleaseAsset {
  name: string
  browser_download_url: string
  download_count: number
}

export interface Release {
  tag_name: string
  assets: ReleaseAsset[]
}

const REPO = 'quangtruong2003/SmoothScroll'
const CACHE_KEY = 'gh-release-latest'

export const FALLBACK_RELEASE = {
  tag_name: 'v1.0.0',
  assets: [
    {
      name: 'SmoothScroll-1.0.0-windows-x64.msi',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-windows-x64.msi`,
      download_count: 0,
    },
    {
      name: 'SmoothScroll-1.0.0-macos.dmg',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-macos.dmg`,
      download_count: 0,
    },
  ],
} as const

export async function fetchLatestRelease(): Promise<Release> {
  if (typeof window === 'undefined') return FALLBACK_RELEASE as unknown as Release

  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) return JSON.parse(cached) as Release
  } catch {}

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as Release
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
    return data
  } catch {
    return FALLBACK_RELEASE as unknown as Release
  }
}

// Deterministic per-day fake download offset.
// Real downloads from GitHub API are added on top, so genuine clicks still count.
// Each day adds 30-100 fakes; same day always returns same number across renders.
export function fakeDownloadOffset(now: number = Date.now()): number {
  const LAUNCH = new Date('2026-01-01').getTime()
  const days = Math.max(0, Math.floor((now - LAUNCH) / 86_400_000))
  let seed = 42
  let total = 0
  for (let i = 0; i < days; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    total += 30 + Math.floor((seed / 0xffffffff) * 71) // 30..100
  }
  return total
}

export function formatDownloadCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return count.toString()
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}
