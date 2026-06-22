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
  isBeta: boolean
  isMac: boolean
  isLinux: boolean
}

const REPO_BASE = 'https://github.com/quangtruong2003/SmoothScroll/releases'
const FALLBACK_URL = `${REPO_BASE}/latest`
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''

const NON_INSTALLER_EXT = /\.(sig|json|blockmap|sha256|sha512|asc|txt|md)$/i

function isInstallable(asset: ReleaseAsset): boolean {
  return !NON_INSTALLER_EXT.test(asset.name)
}

function buildDefaultUrl(os: OS, version: string): { url: string; filename: string } {
  if (!version) return { url: FALLBACK_URL, filename: '' }
  const tag = version.startsWith('v') ? version : `v${version}`
  const ver = version.replace(/^v/, '')
  if (os === 'win') {
    const filename = `SmoothScroll_${ver}_x64-setup.exe`
    return { url: `${REPO_BASE}/download/${tag}/${filename}`, filename }
  }
  if (os === 'mac') {
    const filename = `SmoothScroll_${ver}_aarch64.dmg`
    return { url: `${REPO_BASE}/download/${tag}/${filename}`, filename }
  }
  if (os === 'linux') {
    const filename = `SmoothScroll_${ver}_amd64.AppImage`
    return { url: `${REPO_BASE}/download/${tag}/${filename}`, filename }
  }
  return { url: FALLBACK_URL, filename: '' }
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

  if (os === 'linux') {
    const appimage = installables.find((a) => a.name.toLowerCase().endsWith('.appimage'))
    if (appimage) return appimage.browser_download_url
    const deb = installables.find((a) => a.name.toLowerCase().endsWith('.deb'))
    if (deb) return deb.browser_download_url
    return null
  }

  return null
}

export function useDownloadUrl(): DownloadInfo {
  const [data, setData] = useState<DownloadInfo>(() => {
    const initial = buildDefaultUrl('other', APP_VERSION)
    return {
      url: initial.url,
      filename: initial.filename,
      version: APP_VERSION ? `v${APP_VERSION.replace(/^v/, '')}` : 'latest',
      os: 'other',
      sizeLabel: '',
      ctaLabel: 'Download',
      totalDownloads: '',
      release: null,
      isBeta: false,
      isMac: false,
      isLinux: false,
    }
  })

  useEffect(() => {
    const os = detectOS()
    const built = buildDefaultUrl(os, APP_VERSION)
    const isBeta = os === 'mac'

    setData((prev) => ({
      ...prev,
      url: built.url || prev.url,
      filename: built.filename,
      os,
      ctaLabel: `Download for ${getOSLabel(os)}`,
      isBeta,
      isMac: os === 'mac',
      isLinux: os === 'linux',
    }))

    fetchLatestRelease().then((release) => {
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
        isBeta,
        isMac: os === 'mac',
        isLinux: os === 'linux',
      })
    })
  }, [])

  return data
}
