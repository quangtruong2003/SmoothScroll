'use client'

import { useState } from 'react'
import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Mouse, Gamepad2, ShieldCheck } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [Mouse, Gamepad2, ShieldCheck]

interface PainPointsProps {
  dict: { painPoints?: Dictionary['painPoints'] }
}

export function PainPoints({ dict }: PainPointsProps) {
  const p = dict?.painPoints ?? { title: '', points: [] }
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <section className="py-20 px-4" data-pain-points>
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-16">
            {p.title}
          </h2>
        </FadeUp>
        <div data-pain-points-accordion>
          <StaggerContainer className="flex flex-col md:flex-row gap-3 w-full">
            {(p.points ?? []).map((point, idx) => {
              const Icon = ICONS[idx % ICONS.length]
              const isActive = activeIndex === idx
              const panelId = `pain-point-panel-${idx}`
              const buttonId = `pain-point-button-${idx}`
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  className={`min-w-0 flex flex-col rounded-xl border bg-card text-left transition-[flex-grow,background-color] duration-300 md:min-h-72 ${isActive ? 'md:flex-[3]' : 'md:flex-1'}`}
                  data-pain-point={idx}
                >
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    onClick={() => setActiveIndex(idx)}
                    className="flex w-full items-center gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:h-full md:flex-col md:items-start"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="font-semibold text-lg">{point.title}</span>
                  </button>
                  <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isActive} className="px-5 pb-5 md:mt-auto">
                    <p className="text-muted-foreground leading-relaxed break-words">{point.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </StaggerContainer>
        </div>
      </div>
    </section>
  )
}
