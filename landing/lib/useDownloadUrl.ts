'use client'

import { useState, useEffect } from 'react'
import { detectOS, getOSLabel, type OS } from './os'
import { fetchLatestRelease, formatDownloadCount, type Release, type ReleaseAsset } from './github'

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

const NON_INSTALLER_EXT = /\.(sig|json|blockmap|sha256|sha512|asc|txt|md)$/i

function isInstallable(asset: ReleaseAsset): boolean {
  return !NON_INSTALLER_EXT.test(asset.name)
}

export function findInstallerUrl(release: Release, os: OS): string | null {
  const installables = release.assets.filter(isInstallable)

  if (os === 'mac') {
    const dmgs = installables.filter((a) => a.name.toLowerCase().endsWith('.dmg'))
    const arm = dmgs.find((a) => /aarch64|arm64/i.test(a.name))
    const intel = dmgs.find((a) => /x64|x86_64|intel/i.test(a.name))
    const arch = (navigator as Navigator & { userAgentData?: { architecture?: string } }).userAgentData?.architecture ?? ''
    const isAppleSilicon = /arm|aarch/i.test(arch)
    const pick = isAppleSilicon ? arm ?? intel : intel ?? arm ?? dmgs[0]
    return pick?.browser_download_url ?? null
  }

  if (os === 'win') {
    const exe = installables.find((a) => a.name.toLowerCase().endsWith('.exe'))
    if (exe) return exe.browser_download_url
    const msi = installables.find((a) => a.name.toLowerCase().endsWith('.msi'))
    if (msi) return msi.browser_download_url
    return null
  }

  return null
}

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
      const url = findInstallerUrl(release, os) ?? FALLBACK_URL

      const totalDownloads = release.assets.reduce(
        (sum, a) => sum + (a.download_count || 0),
        0
      )

      setData({
        url,
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
