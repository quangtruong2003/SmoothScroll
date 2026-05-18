import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import {
  Settings2, Layers, Cpu, Battery, ShieldCheck, ToggleLeft
} from 'lucide-react'

const ICONS = [Settings2, Layers, Cpu, Battery, ShieldCheck, ToggleLeft]

interface FeaturesProps {
  dict: {
    features: {
      title: string
      items: { title: string; description: string }[]
    }
  }
}

export function Features({ dict }: FeaturesProps) {
  const { features: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            {f.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {f.items.map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="p-6 rounded-xl border bg-card hover:border-foreground/20 transition-colors"
              >
                <div className="mb-4">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            )
          })}
        </StaggerContainer>
      </div>
    </section>
  )
}
