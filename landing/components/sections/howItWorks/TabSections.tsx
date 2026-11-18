'use client'

import {
  Sliders,
  Keyboard as KeyboardIcon,
  Wrench,
  AppWindow,
  Gamepad2,
  Settings as SettingsIcon,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import { EasingCurveViz } from '@/components/EasingCurveViz'
import type { Dictionary } from '@/lib/i18n/dict'

const TAB_ICONS: Record<string, LucideIcon> = {
  scroll: Sliders,
  devices: KeyboardIcon,
  advanced: Wrench,
  apps: AppWindow,
  gamemode: Gamepad2,
  behavior: SettingsIcon,
  about: Info,
}

interface TabSectionsProps {
  tabs: NonNullable<NonNullable<Dictionary['howItWorks']>['tabs']>
  dict?: Dictionary
}

export function TabSections({ tabs, dict }: TabSectionsProps) {
  const sections = tabs.sections ?? []
  const rangeLabel = tabs.rangeLabel ?? 'Range'
  const defaultLabel = tabs.defaultLabel ?? 'Default'

  return (
    <section className="py-16 sm:py-24 px-4 border-t">
      <div className="container max-w-5xl">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {tabs.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {tabs.subtitle}
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <nav
            aria-label={tabs.tocLabel}
            className="mt-8 flex flex-wrap justify-start sm:justify-center gap-1.5 sm:gap-2 rounded-xl border bg-card p-2.5 sm:p-3"
          >
            {sections.map((section) => {
              const Icon = TAB_ICONS[section.id ?? ''] ?? SettingsIcon
              return (
                <a
                  key={section.id}
                  href={`#tab-${section.id}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] motion-safe:transition-[color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{section.label}</span>
                </a>
              )
            })}
          </nav>
        </FadeUp>

        <div className="mt-14 sm:mt-16 space-y-16 sm:space-y-20">
          {sections.map((section) => {
            const Icon = TAB_ICONS[section.id ?? ''] ?? SettingsIcon
            return (
              <article
                key={section.id}
                id={`tab-${section.id}`}
                className="scroll-mt-24"
              >
                <FadeUp>
                  <header className="flex items-start gap-3.5 sm:gap-4 pb-5 border-b">
                    <div className="mt-0.5 shrink-0 inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {section.label}
                      </h3>
                      <p className="mt-1.5 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
                        {section.intro}
                      </p>
                    </div>
                  </header>
                </FadeUp>

                <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.id === 'scroll' && (
                    <div className="min-w-0 sm:col-span-2">
                      <EasingCurveViz viz={dict?.howItWorks?.easingViz} />
                    </div>
                  )}
                  {(section.settings ?? []).map((setting, idx) => (
                    <FadeUp key={idx} delay={Math.min(idx, 4) * 0.04} className="h-full min-w-0">
                      <SettingCard
                        setting={setting}
                        rangeLabel={rangeLabel}
                        defaultLabel={defaultLabel}
                      />
                    </FadeUp>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

type SettingItem = NonNullable<
  NonNullable<NonNullable<Dictionary['howItWorks']>['tabs']>['sections']
>[number] extends { settings?: (infer T)[] }
  ? T
  : never

function SettingCard({
  setting,
  rangeLabel,
  defaultLabel,
}: {
  setting: SettingItem
  rangeLabel: string
  defaultLabel: string
}) {
  return (
    <div className="flex h-full min-w-0 flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="min-w-0">
        <h4 className="text-base font-semibold tracking-tight text-foreground">
          {setting.name}
        </h4>
        <p className="mt-2 text-sm text-foreground/85 leading-relaxed [overflow-wrap:anywhere]">
          {setting.what}
        </p>
        {setting.why && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">
            {setting.why}
          </p>
        )}
      </div>

      {((setting.range && setting.range !== '-') || (setting.defaultValue && setting.defaultValue !== '-')) && (
        <dl className="mt-4 pt-3.5 border-t border-border/60 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
          {setting.range && setting.range !== '-' && (
            <>
              <dt className="text-muted-foreground uppercase tracking-wide font-medium">
                {rangeLabel}
              </dt>
              <dd className="font-mono text-foreground/90 break-words">
                {setting.range}
              </dd>
            </>
          )}
          {setting.defaultValue && setting.defaultValue !== '-' && (
            <>
              <dt className="text-muted-foreground uppercase tracking-wide font-medium">
                {defaultLabel}
              </dt>
              <dd className="font-mono text-foreground/90 break-words">
                {setting.defaultValue}
              </dd>
            </>
          )}
        </dl>
      )}

      {setting.tip && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{setting.tip}</span>
        </div>
      )}
    </div>
  )
}
