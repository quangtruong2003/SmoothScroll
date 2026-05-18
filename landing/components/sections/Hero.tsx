import { DemoScroll } from '@/components/DemoScroll'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Badge } from '@/components/ui/badge'

interface HeroProps {
  dict: {
    hero: {
      eyebrow: string
      title: string
      titleAccent: string
      subtitle: string
      cta: string
      trustLine: string
      seeHow: string
      demoPrompt: string
      demoToast: string
    }
  }
}

export function Hero({ dict }: HeroProps) {
  const { hero: h } = dict

  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 px-4">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit">{h.eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {h.title}{' '}
              <span className="bg-gradient-to-br from-brand-from to-brand-to bg-clip-text text-transparent">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <DownloadCTA label={h.cta} variant="brand" size="lg" />
              <a href="#how-it-works" className="flex items-center justify-center px-6 py-2 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors">
                {h.seeHow}
              </a>
            </div>

            <p className="text-sm text-muted-foreground">{h.trustLine}</p>
          </div>

          {/* Right: Demo */}
          <div>
            <DemoScroll prompt={h.demoPrompt} toastMessage={h.demoToast} />
          </div>
        </div>
      </div>
    </section>
  )
}
