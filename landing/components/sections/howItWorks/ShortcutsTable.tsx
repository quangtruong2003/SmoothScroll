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
            <div className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Keyboard className="h-5 w-5" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {shortcuts.title}
            </h2>
          </div>
        </FadeUp>
        <FadeUp delay={0.05}>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            {shortcuts.subtitle}
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm sm:min-w-[520px]">
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
                    <td className="px-4 sm:px-5 py-3.5 align-top leading-relaxed">
                      <span className="block text-foreground">{row.action}</span>
                      {row.scope && (
                        <span className="mt-1 block text-xs text-muted-foreground sm:hidden">
                          {row.scope}
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 align-top">
                      <KeysDisplay value={row.keys ?? ''} />
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 align-top hidden sm:table-cell text-muted-foreground whitespace-nowrap">
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
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              {shortcuts.hotkeyNote}
            </p>
          </FadeUp>
        )}
      </div>
    </section>
  )
}

function SingleCombo({ value }: { value: string }) {
  const trimmed = value.trim()
  const parts = trimmed.split('+').map((p) => p.trim())
  const isCombo = parts.length > 1 && parts.every((p) => p.length <= 10)
  const isSingleKey = parts.length === 1 && trimmed.length <= 6 && !/\s/.test(trimmed)

  if (!isCombo && !isSingleKey) {
    return <span className="text-foreground/85 leading-relaxed">{trimmed}</span>
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

function KeysDisplay({ value }: { value: string }) {
  const orMatch = value.match(/^(.+?)\s+(or|hoặc|或)\s+(.+)$/i)
  if (orMatch) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <SingleCombo value={orMatch[1]} />
        <span className="text-xs text-muted-foreground">{orMatch[2]}</span>
        <SingleCombo value={orMatch[3]} />
      </span>
    )
  }

  const slashParts = value.split('/').map((p) => p.trim())
  if (slashParts.length === 2 && slashParts.every((p) => p.length <= 14 && !/tray|khay|托盘/i.test(p))) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <SingleCombo value={slashParts[0]} />
        <span className="text-muted-foreground/60">/</span>
        <SingleCombo value={slashParts[1]} />
      </span>
    )
  }

  return <SingleCombo value={value} />
}
