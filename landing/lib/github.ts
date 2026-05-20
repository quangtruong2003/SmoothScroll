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
  tag_name: 'latest',
  assets: [],
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

// Real GitHub download counts only — no fake offsets.
// download_count is tracked per release asset by GitHub when users
// download files via the asset URL.
export function fakeDownloadOffset(): number {
  return 0
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
