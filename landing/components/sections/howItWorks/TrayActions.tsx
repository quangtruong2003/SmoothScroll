'use client'

import { MousePointer, MousePointerClick, AppWindow } from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

interface TrayActionsProps {
  tray: NonNullable<NonNullable<Dictionary['howItWorks']>['tray']>
}

export function TrayActions({ tray }: TrayActionsProps) {
  return (
    <section className="py-16 sm:py-24 px-4 border-t">
      <div className="container max-w-5xl">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {tray.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            {tray.subtitle}
          </p>
        </FadeUp>

        <div className="mt-10 grid lg:grid-cols-2 gap-5">
          <FadeUp delay={0.1}>
            <TrayCard
              icon={<MousePointer className="h-5 w-5" />}
              title={tray.leftClick?.title ?? ''}
              description={tray.leftClick?.description ?? ''}
              items={tray.leftClick?.items ?? []}
              accent="primary"
            />
          </FadeUp>
          <FadeUp delay={0.15}>
            <TrayCard
              icon={<MousePointerClick className="h-5 w-5" />}
              title={tray.rightClick?.title ?? ''}
              description={tray.rightClick?.description ?? ''}
              items={tray.rightClick?.items ?? []}
              accent="muted"
            />
          </FadeUp>
        </div>

        {tray.perApp && (
          <FadeUp delay={0.2}>
            <div className="mt-5 flex items-start gap-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
              <div className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <AppWindow className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{tray.perApp.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {tray.perApp.description}
                </p>
              </div>
            </div>
          </FadeUp>
        )}
      </div>
    </section>
  )
}

interface TrayCardProps {
  icon: React.ReactNode
  title: string
  description: string
  items: string[]
  accent: 'primary' | 'muted'
}

function TrayCard({ icon, title, description, items, accent }: TrayCardProps) {
  const ringClass =
    accent === 'primary'
      ? 'bg-primary/10 text-primary ring-primary/20'
      : 'bg-muted text-foreground/80 ring-border'

  return (
    <div className="h-full rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${ringClass}`}
        >
          {icon}
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      <ul className="mt-5 space-y-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2.5 text-sm text-foreground/85"
          >
            <span
              aria-hidden
              className="h-1 w-1 rounded-full bg-foreground/40 shrink-0"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
