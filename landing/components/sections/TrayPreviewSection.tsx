'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { TrayPreview } from '@/components/TrayPreview'
import type { Dictionary } from '@/lib/i18n/dict'

interface TrayPreviewSectionProps {
  dict: { trayPreview?: Dictionary['trayPreview'] }
}

export function TrayPreviewSection({ dict }: TrayPreviewSectionProps) {
  const t = dict?.trayPreview ?? { title: '', subtitle: '' }

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t.title}</h2>
            <p className="text-lg text-muted-foreground">{t.subtitle}</p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="flex justify-center lg:justify-end">
              <TrayPreview />
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
