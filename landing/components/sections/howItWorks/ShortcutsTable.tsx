'use client'

import { Keyboard } from 'lucide-react'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

interface ShortcutsTableProps {
  shortcuts: NonNullable<NonNullable<Dictionary['howItWorks']>['shortcuts']>
}

export function ShortcutsTable({ shortcuts }: ShortcutsTableProps) {
  const headers = shortcuts.tableHeaders ?? {}
  const rows = shortcuts.rows ?? []

  return (
    <section
      id="shortcuts"
      className="py-16 sm:py-24 px-4 border-t scroll-mt-24"
    >
      <div className="container max-w-5xl">
        <FadeUp>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Keyboard className="h-5 w-5" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {shortcuts.title}
            </h2>
          </div>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {shortcuts.subtitle}
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium px-4 sm:px-5 py-3">
                    {headers.action}
                  </th>
                  <th className="text-left font-medium px-4 sm:px-5 py-3">
                    {headers.keys}
                  </th>
                  <th className="text-left font-medium px-4 sm:px-5 py-3 hidden sm:table-cell">
                    {headers.scope}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 sm:px-5 py-3.5 align-top">
                      {row.action}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 align-top">
                      <KeysDisplay value={row.keys ?? ''} />
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 align-top hidden sm:table-cell text-muted-foreground">
                      {row.scope}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>

        {shortcuts.hotkeyNote && (
          <FadeUp delay={0.15}>
            <p className="mt-5 text-sm text-muted-foreground">
              {shortcuts.hotkeyNote}
            </p>
          </FadeUp>
        )}
      </div>
    </section>
  )
}

function KeysDisplay({ value }: { value: string }) {
  const parts = value.split('+').map((p) => p.trim())
  const isCombo = parts.length > 1 && parts.every((p) => p.length <= 8)

  if (!isCombo) {
    return <span className="text-foreground/80">{value}</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((part, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          {idx > 0 && <span className="text-muted-foreground/60">+</span>}
          <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] font-semibold text-foreground/90 shadow-sm">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  )
}
