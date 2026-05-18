import { DownloadCTA } from '@/components/DownloadCTA'
import { Separator } from '@/components/ui/separator'

interface FinalCTAProps {
  dict: {
    finalCta: {
      title: string
      subtitle: string
      cta: string
      ctaSub: string
    }
  }
}

export function FinalCTA({ dict }: FinalCTAProps) {
  const { finalCta: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <Separator className="mb-16" />
        <div className="text-center max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{f.title}</h2>
          <p className="text-lg text-muted-foreground">{f.subtitle}</p>
          <DownloadCTA label={f.cta} variant="brand" size="lg" />
          <p className="text-sm text-muted-foreground">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}
