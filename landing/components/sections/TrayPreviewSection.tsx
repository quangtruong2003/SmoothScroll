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
    <section className="bg-muted/30 px-4 py-20 dark:bg-white/[0.04]">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeUp className="min-w-0">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h2>
            <p className="break-words text-lg text-muted-foreground">{t.subtitle}</p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="mx-auto max-w-sm lg:mx-0 lg:ml-auto">
              <TrayPreview locale={locale} />
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
