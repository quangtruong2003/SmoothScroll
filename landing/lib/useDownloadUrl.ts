'use client'

import { useState, useEffect } from 'react'
import { detectOS, getOSLabel, type OS } from './os'
import { fetchLatestRelease, formatDownloadCount, type Release, type ReleaseAsset } from './github'

export interface DownloadInfo {
  url: string
  filename: string
  version: string
  os: ReturnType<typeof detectOS>
  sizeLabel: string
  ctaLabel: string
  totalDownloads: string
  release: Release | null
  loading: boolean
  error: string | null
}

const REPO_BASE = 'https://github.com/quangtruong2003/SmoothScroll/releases'
const FALLBACK_URL = `${REPO_BASE}/latest`
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''

const NON_INSTALLER_EXT = /\.(sig|json|blockmap|sha256|sha512|asc|txt|md)$/i

function isInstallable(asset: ReleaseAsset): boolean {
  return !NON_INSTALLER_EXT.test(asset.name)
}

function buildDefaultUrl(version: string): { url: string; filename: string } {
  if (!version) return { url: FALLBACK_URL, filename: '' }
  const tag = version.startsWith('v') ? version : `v${version}`
  const ver = version.replace(/^v/, '')
  const filename = `SmoothScroll_${ver}_x64-setup.exe`
  return { url: `${REPO_BASE}/download/${tag}/${filename}`, filename }
}

export function findInstallerUrl(release: Release, os: OS): string | null {
  const installables = release.assets.filter(isInstallable)
  // Windows-only product: always prefer the .exe, fall back to .msi.
  const exe = installables.find((a) => a.name.toLowerCase().endsWith('.exe'))
  if (exe) return exe.browser_download_url
  const msi = installables.find((a) => a.name.toLowerCase().endsWith('.msi'))
  if (msi) return msi.browser_download_url
  return null
}

export function useDownloadUrl(): DownloadInfo {
  const [data, setData] = useState<DownloadInfo>(() => {
    const initial = buildDefaultUrl(APP_VERSION)
    return {
      url: initial.url,
      filename: initial.filename,
      version: APP_VERSION ? `v${APP_VERSION.replace(/^v/, '')}` : 'latest',
      os: 'other',
      sizeLabel: '',
      ctaLabel: 'Download',
      totalDownloads: '',
      release: null,
      loading: true,
      error: null,
    }
  })

  useEffect(() => {
    const os = detectOS()
    const built = buildDefaultUrl(APP_VERSION)

    setData((prev) => ({
      ...prev,
      url: built.url || prev.url,
      filename: built.filename,
      os,
      ctaLabel: `Download for ${getOSLabel(os)}`,
    }))

    fetchLatestRelease()
      .then((release) => {
        const apiUrl = findInstallerUrl(release, os)
        const url = apiUrl ?? built.url

        const filename = (() => {
          if (apiUrl) {
            try {
              return new URL(apiUrl).pathname.split('/').pop() ?? built.filename
            } catch {
              return built.filename
            }
          }
          return built.filename
        })()

        const totalDownloads = release.assets.reduce(
          (sum, a) => sum + (a.download_count || 0),
          0
        )

        setData({
          url,
          filename,
          version: release.tag_name || (APP_VERSION ? `v${APP_VERSION.replace(/^v/, '')}` : 'latest'),
          os,
          sizeLabel: '',
          ctaLabel: `Download for ${getOSLabel(os)}`,
          totalDownloads: totalDownloads > 0 ? formatDownloadCount(totalDownloads) : '',
          release,
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch release',
        }))
      })
  }, [])

  return data
}
