'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { fetchLatestRelease, formatDownloadCount, fakeDownloadOffset } from '@/lib/github'
import { Star, Download, Tag } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'
import { useState, useEffect, useMemo } from 'react'

interface StatsProps {
  dict: { stats?: Dictionary['stats'] }
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Star
  value: string
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-3xl font-bold tracking-tight">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export function Stats({ dict }: StatsProps) {
  const s = dict?.stats ?? {
    title: '',
    githubStars: '',
    downloads: '',
    version: '',
    fallback: { stars: '—', downloads: '—', version: '—' },
  }
  const fb = useMemo(() => s.fallback ?? { stars: '—', downloads: '—', version: '—' }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [stars, setStars] = useState<string>(fb.stars ?? '—')
  const [downloads, setDownloads] = useState<string>(formatDownloadCount(fakeDownloadOffset()))
  const [version, setVersion] = useState<string>(fb.version ?? '—')

  useEffect(() => {
    const fallbackStars = fb.stars ?? '—'
    const fallbackVersion = fb.version ?? '—'

    fetchLatestRelease()
      .then((releaseData) => {
        const realDownloads = releaseData.assets.reduce(
          (sum, a) => sum + (a.download_count ?? 0),
          0
        )
        setDownloads(formatDownloadCount(realDownloads + fakeDownloadOffset()))
        setVersion(releaseData.tag_name ?? fallbackVersion)
      })
      .catch(() => {})

    const cachedStars = (() => {
      try { return sessionStorage.getItem('gh-stars') } catch { return null }
    })()
    if (cachedStars) {
      setStars(cachedStars)
      return
    }
    fetch('https://api.github.com/repos/quangtruong2003/SmoothScroll')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const value = d?.stargazers_count?.toLocaleString() ?? fallbackStars
        setStars(value)
        try { sessionStorage.setItem('gh-stars', value) } catch {}
      })
      .catch(() => {})
  }, [fb])

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            {s.title}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <StatCard icon={Star} value={stars} label={s.githubStars ?? ''} />
            <StatCard icon={Download} value={downloads} label={s.downloads ?? ''} />
            <StatCard icon={Tag} value={version} label={s.version ?? ''} />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
