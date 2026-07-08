'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { fetchLatestRelease } from '@/lib/github'
import { useGitHubStars } from '@/lib/useGitHubStars'
import { Star, Tag } from 'lucide-react'
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
    version: '',
    fallback: { stars: '-', version: '-' },
  }
  const fb = useMemo(() => s.fallback ?? { stars: '-', version: '-' }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const liveStars = useGitHubStars()
  const [version, setVersion] = useState<string>(fb.version ?? '-')

  useEffect(() => {
    const fallbackVersion = fb.version ?? '-'

    fetchLatestRelease()
      .then((releaseData) => {
        setVersion(releaseData.tag_name ?? fallbackVersion)
      })
      .catch(() => {})
  }, [fb])

  const starsDisplay = liveStars !== null ? liveStars.toLocaleString() : (fb.stars ?? '-')

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            {s.title}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="grid sm:grid-cols-2 gap-6 max-w-xl mx-auto w-full">
            <StatCard icon={Star} value={starsDisplay} label={s.githubStars ?? ''} />
            <StatCard icon={Tag} value={version} label={s.version ?? ''} />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
