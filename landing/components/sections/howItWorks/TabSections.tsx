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

  return (
    <section className="py-16 sm:py-24 px-4 border-t">
      <div className="container max-w-5xl">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {tabs.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            {tabs.subtitle}
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <nav
            aria-label={tabs.tocLabel}
            className="mt-8 flex flex-wrap justify-center gap-2 rounded-xl border bg-card p-3"
          >
            {sections.map((section) => {
              const Icon = TAB_ICONS[section.id ?? ''] ?? SettingsIcon
              return (
                <a
                  key={section.id}
                  href={`#tab-${section.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                </a>
              )
            })}
          </nav>
        </FadeUp>

        <div className="mt-16 space-y-20">
          {sections.map((section) => {
            const Icon = TAB_ICONS[section.id ?? ''] ?? SettingsIcon
            return (
              <article
                key={section.id}
                id={`tab-${section.id}`}
                className="scroll-mt-24"
              >
                <FadeUp>
                  <header className="flex items-start gap-4 pb-6 border-b">
                    <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {section.label}
                      </h3>
                      <p className="mt-1.5 text-base text-muted-foreground">
                        {section.intro}
                      </p>
                    </div>
                  </header>
                </FadeUp>

                <div className="mt-8 grid sm:grid-cols-2 gap-4">
                  {section.id === 'scroll' && (
                    <div className="sm:col-span-2">
                      <EasingCurveViz viz={dict?.howItWorks?.easingViz} />
                    </div>
                  )}
                  {(section.settings ?? []).map((setting, idx) => (
                    <FadeUp key={idx} delay={Math.min(idx, 4) * 0.04}>
                      <SettingCard setting={setting} />
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

function SettingCard({ setting }: { setting: SettingItem }) {
  return (
    <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20">
      <h4 className="font-semibold text-foreground">{setting.name}</h4>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {setting.what}
      </p>
      {setting.why && (
        <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed">
          {setting.why}
        </p>
      )}

      {(setting.range || setting.defaultValue) && (
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {setting.range && (
            <>
              <dt className="text-muted-foreground/60 uppercase tracking-wide">
                Range
              </dt>
              <dd className="font-mono text-foreground/90">{setting.range}</dd>
            </>
          )}
          {setting.defaultValue && (
            <>
              <dt className="text-muted-foreground/60 uppercase tracking-wide">
                Default
              </dt>
              <dd className="font-mono text-foreground/90">
                {setting.defaultValue}
              </dd>
            </>
          )}
        </dl>
      )}

      {setting.tip && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{setting.tip}</span>
        </div>
      )}
    </div>
  )
}
