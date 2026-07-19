'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Zap, Monitor, AppWindow, Layers, Gamepad2, ShieldCheck } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [Zap, Monitor, AppWindow, Layers, Gamepad2, ShieldCheck]

interface FeaturesProps {
  dict: { features?: Dictionary['features'] }
}

export function Features({ dict }: FeaturesProps) {
  const f: { title?: string; items?: { title?: string; description?: string }[] } = dict?.features ?? { title: '', items: [] }
  const items = f.items ?? []

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">{f.title}</h2>
        </FadeUp>
        <StaggerContainer className="features-bento grid grid-flow-dense mt-12 w-full" data-features-bento>
          {items.slice(0, 3).map((item, index) => {
            const Icon = ICONS[index % ICONS.length]
            return <FeatureCard key={index} item={item} index={index} Icon={Icon} />
          })}
          <ul className="features-continuation" data-feature-continuation>
            {items.slice(3).map((item, offset) => {
              const index = offset + 3
              const Icon = ICONS[index % ICONS.length]
              return (
                <motion.li key={index} variants={staggerItem} data-feature-continuation-item className="feature-continuation-item">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed break-words">{item.description}</p>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        </StaggerContainer>
      </div>
    </section>
  )
}

function FeatureCard({ item, index, Icon }: { item: { title?: string; description?: string }; index: number; Icon: typeof Zap }) {
  return (
    <motion.div
      variants={staggerItem}
      data-feature-card={index}
      data-grid-span={index === 0 ? '7x2' : '5x1'}
      className={`feature-card min-w-0 p-6 border bg-card text-center overflow-hidden ${index === 0 ? 'feature-card-primary' : ''}`}
    >
      <div className="mb-4 flex justify-center"><Icon className="h-6 w-6 text-muted-foreground" /></div>
      <h3 className="font-semibold mb-2">{item.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed break-words">{item.description}</p>
    </motion.div>
  )
}
