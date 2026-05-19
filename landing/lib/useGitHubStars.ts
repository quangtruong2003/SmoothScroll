'use client'

import { useEffect, useState } from 'react'

const REPO = 'quangtruong2003/SmoothScroll'
const STORAGE_KEY = 'gh-stars-v2'
const TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  value: number | null
  ts: number
}

function readCache(): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(value: number | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ value, ts: Date.now() }))
  } catch {}
}

export function useGitHubStars(): number | null {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setStars(cached.value)
      return
    }

    const controller = new AbortController()
    fetch(`https://api.github.com/repos/${REPO}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const value = typeof d?.stargazers_count === 'number' ? d.stargazers_count : null
        setStars(value)
        writeCache(value)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [])

  return stars
}
