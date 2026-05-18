'use client'

import Image from 'next/image'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

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
              <div className="relative max-w-sm w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-border">
                <Image
                  src={`${BASE_PATH}/assets/screenshot-tray.png`}
                  alt="SmoothScroll system tray panel"
                  width={300}
                  height={430}
                  className="w-full h-auto block"
                  priority={false}
                />
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
