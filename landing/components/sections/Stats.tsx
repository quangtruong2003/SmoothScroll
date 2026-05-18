import { FadeUp } from '@/components/motion/FadeUp'
import { fetchLatestRelease, formatDownloadCount } from '@/lib/github'
import { Star, Download, Tag } from 'lucide-react'

interface StatsProps {
  dict: {
    stats: {
      title: string
      githubStars: string
      downloads: string
      version: string
      fallback: { stars: string; downloads: string; version: string }
    }
  }
}

interface StatsInnerProps extends StatsProps['dict']['stats'] {
  releaseData: Awaited<ReturnType<typeof fetchLatestRelease>> | null
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

export async function Stats({ dict }: StatsProps) {
  let releaseData = null
  try {
    releaseData = await fetchLatestRelease()
  } catch { /* intentionally empty */ }

  const { stats: s, fallback } = dict
  const stars = releaseData
    ? (await fetch(`https://api.github.com/repos/grayscut/SmoothScroll`).then((r) => r.json()).catch(() => null))?.stargazers_count?.toLocaleString() ?? fallback.stars
    : fallback.stars
  const downloads = releaseData
    ? formatDownloadCount(releaseData.assets.reduce((sum, a) => sum + (a.download_count ?? 0), 0))
    : fallback.downloads
  const version = releaseData?.tag_name ?? fallback.version

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
            <StatCard icon={Star} value={stars} label={s.githubStars} />
            <StatCard icon={Download} value={downloads} label={s.downloads} />
            <StatCard icon={Tag} value={version} label={s.version} />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
