'use client'

import { useState, useEffect } from 'react'
import { detectOS, getOSLabel } from './os'
import { fetchLatestRelease, formatDownloadCount, type Release } from './github'

export interface DownloadInfo {
  url: string
  version: string
  os: ReturnType<typeof detectOS>
  sizeLabel: string
  ctaLabel: string
  totalDownloads: string
  release: Release | null
}

const FALLBACK_URL = 'https://github.com/quangtruong2003/SmoothScroll/releases/latest'

export function useDownloadUrl(): DownloadInfo {
  const [data, setData] = useState<DownloadInfo>({
    url: FALLBACK_URL,
    version: 'v1.0.0',
    os: 'other',
    sizeLabel: '',
    ctaLabel: 'Download',
    totalDownloads: '50k+',
    release: null,
  })

  useEffect(() => {
    const os = detectOS()

    setData((prev) => ({
      ...prev,
      os,
      ctaLabel: `Download for ${getOSLabel(os)}`,
    }))

    fetchLatestRelease().then((release) => {
      const assetName = os === 'mac' ? 'dmg' : 'msi'
      const asset = release.assets.find((a) =>
        a.name.toLowerCase().includes(assetName)
      )
      const fallbackAsset = release.assets[0]

      const totalDownloads = release.assets.reduce(
        (sum, a) => sum + (a.download_count || 0),
        0
      )

      setData({
        url: asset?.browser_download_url ?? fallbackAsset?.browser_download_url ?? FALLBACK_URL,
        version: release.tag_name,
        os,
        sizeLabel: '',
        ctaLabel: `Download for ${getOSLabel(os)}`,
        totalDownloads: formatDownloadCount(totalDownloads),
        release,
      })
    })
  }, [])

  return data
}
