export const DOWNLOAD_ATTRIBUTION_KEY = 'smoothscroll:last-download-intent'

export interface DownloadAttribution {
  page: string
  search: string
  referrer: string
  downloadUrl: string
  timestamp: number
}

export function recordDownloadIntent(downloadUrl: string): DownloadAttribution | null {
  if (typeof window === 'undefined') return null

  const detail: DownloadAttribution = {
    page: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer,
    downloadUrl,
    timestamp: Date.now(),
  }

  try {
    window.sessionStorage.setItem(DOWNLOAD_ATTRIBUTION_KEY, JSON.stringify(detail))
  } catch {
    // Attribution is optional and local-only; a storage failure must never block a download.
  }

  window.dispatchEvent(new CustomEvent<DownloadAttribution>('smoothscroll:downloaded', { detail }))
  return detail
}
