'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { TrayPreview } from '@/components/TrayPreview'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

interface TrayPreviewSectionProps {
  dict: { trayPreview?: Dictionary['trayPreview'] }
}

export function TrayPreviewSection({ dict }: TrayPreviewSectionProps) {
  const t = dict?.trayPreview ?? { title: '', subtitle: '' }
  const { locale } = useLanguage()

  return (
    <section className="py-20 px-4 bg-muted/30 dark:bg-white/[0.04]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <FadeUp className="min-w-0">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t.title}</h2>
            <p className="text-lg text-muted-foreground break-words">{t.subtitle}</p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="flex justify-center lg:justify-end">
              <div className="relative max-w-sm w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-border">
                <TrayPreview locale={locale} />
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
