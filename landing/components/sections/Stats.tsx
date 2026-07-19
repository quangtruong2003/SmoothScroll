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
  loading,
}: {
  icon: typeof Star
  value: string
  label: string
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-4 border-l-2 border-border px-4 py-2 first:border-l-0 sm:px-6">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {loading ? (
        <div className="h-9 w-24 rounded bg-muted animate-pulse" />
      ) : (
        <span className="text-3xl font-bold tracking-tight">{value}</span>
      )}
      <span className="block text-sm text-muted-foreground">{label}</span>
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
  const [loadingVersion, setLoadingVersion] = useState(true)

  useEffect(() => {
    const fallbackVersion = fb.version ?? '-'

    fetchLatestRelease()
      .then((releaseData) => {
        setVersion(releaseData.tag_name ?? fallbackVersion)
        setLoadingVersion(false)
      })
      .catch(() => {
        setVersion(fallbackVersion)
        setLoadingVersion(false)
      })
  }, [fb])

  const starsDisplay = liveStars !== null ? liveStars.toLocaleString() : (fb.stars ?? '-')

  return (
    <section className="py-32 px-4 md:py-48">
      <div className="container">
        <FadeUp>
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            {s.title}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="mx-auto flex w-full max-w-xl flex-col justify-center gap-4 sm:flex-row sm:gap-0">
            <StatCard
              icon={Star}
              value={starsDisplay}
              label={s.githubStars ?? ''}
              loading={liveStars === null}
            />
            <StatCard
              icon={Tag}
              value={version}
              label={s.version ?? ''}
              loading={loadingVersion}
            />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
