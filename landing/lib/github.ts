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

export const FALLBACK_RELEASE = {
  tag_name: 'v1.0.0',
  assets: [
    {
      name: 'SmoothScroll-1.0.0-windows-x64.msi',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-windows-x64.msi`,
      download_count: 12000,
    },
    {
      name: 'SmoothScroll-1.0.0-macos.dmg',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-macos.dmg`,
      download_count: 8000,
    },
  ],
} as const

export async function fetchLatestRelease(): Promise<Release> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github+json' },
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Release
  } catch {
    return FALLBACK_RELEASE as unknown as Release
  }
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
