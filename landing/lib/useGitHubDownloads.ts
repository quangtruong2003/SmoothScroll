'use client'

import { useEffect, useState } from 'react'
import { sumReleaseDownloads, type Release } from './github'

const REPO = 'quangtruong2003/SmoothScroll'
const STORAGE_KEY = 'gh-downloads-v1'
const TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  value: number
  ts: number
}

interface GitHubDownloadsState {
  value: number | null
  loading: boolean
}

function readCache(): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.ts > TTL_MS || typeof parsed.value !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(value: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ value, ts: Date.now() }))
  } catch {}
}

export function useGitHubDownloads(): GitHubDownloadsState {
  const [state, setState] = useState<GitHubDownloadsState>({ value: null, loading: true })

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setState({ value: cached.value, loading: false })
      return
    }

    const controller = new AbortController()
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((releases) => {
        const value = Array.isArray(releases) ? sumReleaseDownloads(releases as Release[]) : null
        setState({ value, loading: false })
        if (value !== null) writeCache(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ value: null, loading: false })
      })

    return () => controller.abort()
  }, [])

  return state
}
