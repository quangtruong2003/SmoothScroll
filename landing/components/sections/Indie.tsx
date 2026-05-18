import { FadeUp } from '@/components/motion/FadeUp'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Github, Check, Lock, Ban, Globe } from 'lucide-react'

const RADIX_INDIE = [0, 1, 2, 3] as const

interface IndieProps {
  dict: {
    indie: {
      title: string
      subtitle: string
      points: string[]
      cta: string
    }
  }
}

export function Indie({ dict }: IndieProps) {
  const { indie: i } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{i.title}</h2>
              <p className="text-muted-foreground text-lg">{i.subtitle}</p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {i.points.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-card border">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{point}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="text-center">
              <Button variant="outline" size="lg" asChild>
                <a href="https://github.com/grayscut/SmoothScroll" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4 mr-2" />
                  {i.cta}
                </a>
              </Button>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
