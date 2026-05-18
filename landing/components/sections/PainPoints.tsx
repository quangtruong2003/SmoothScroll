'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Zap, BatteryLow, Mouse } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [Zap, BatteryLow, Mouse]

interface PainPointsProps {
  dict: { painPoints?: Dictionary['painPoints'] }
}

export function PainPoints({ dict }: PainPointsProps) {
  const p = dict?.painPoints ?? { title: '', points: [] }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-16">
            {p.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid md:grid-cols-3 gap-8">
          {(p.points ?? []).map((point, idx) => {
            const Icon = ICONS[idx]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="flex flex-col gap-4 p-6 rounded-xl border bg-card"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{point.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{point.description}</p>
              </motion.div>
            )
          })}
        </StaggerContainer>
      </div>
    </section>
  )
}
