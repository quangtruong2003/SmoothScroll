'use client'

import { useState } from 'react'
import { FadeUp } from '@/components/motion/FadeUp'
import type { Dictionary } from '@/lib/i18n/dict'

interface EasingCurveVizProps {
  viz?: NonNullable<NonNullable<Dictionary['howItWorks']>['easingViz']>
}

const CURVES = [
  { id: 'exponentialOut', label: 'exponentialOut', color: '#6366f1' },
  { id: 'cubicOut',       label: 'cubicOut',       color: '#8b5cf6' },
  { id: 'quinticOut',     label: 'quinticOut',     color: '#3b82f6' },
  { id: 'linear',         label: 'linear',          color: '#94a3b8' },
]

function generatePath(fn: (t: number) => number): string {
  const points: string[] = []
  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    const x = 20 + t * 260
    const y = 130 - fn(t) * 110
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
}

const CURVE_FNS: Record<string, (t: number) => number> = {
  exponentialOut: (t) => 1 - Math.exp(-6 * t),
  cubicOut:       (t) => 1 - Math.pow(1 - t, 3),
  quinticOut:     (t) => 1 - Math.pow(1 - t, 5),
  linear:         (t) => t,
}

export function EasingCurveViz({ viz }: EasingCurveVizProps) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <FadeUp>
      <div className="mb-8 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground">
            {viz?.title ?? 'Easing curves'}
          </h4>
          <span className="text-sm text-muted-foreground">
            {viz?.subtitle ?? 'Click a curve to highlight it.'}
          </span>
        </div>

        {/* SVG chart */}
        <svg
          viewBox="0 0 300 150"
          className="w-full max-w-sm mx-auto select-none"
          aria-label="Easing curve comparison chart"
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((v) => (
            <line
              key={v}
              x1={20}
              y1={130 - v * 110}
              x2={280}
              y2={130 - v * 110}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}

          {/* Axes */}
          <line x1={20} y1={130} x2={280} y2={130} stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
          <line x1={20} y1={130} x2={20} y2={20} stroke="hsl(var(--muted-foreground))" strokeWidth="1" />

          {/* Axis labels */}
          <text x={5} y={25} fontSize="9" fill="hsl(var(--muted-foreground))">1.0</text>
          <text x={5} y={68} fontSize="9" fill="hsl(var(--muted-foreground))">0.5</text>
          <text x={5} y={133} fontSize="9" fill="hsl(var(--muted-foreground))">0</text>
          <text x={270} y={140} fontSize="9" fill="hsl(var(--muted-foreground))">t</text>

          {/* Curves */}
          {CURVES.map((curve) => {
            const isActive = active === null || active === curve.id
            const isSelected = active === curve.id
            return (
              <path
                key={curve.id}
                d={generatePath(CURVE_FNS[curve.id])}
                fill="none"
                stroke={curve.color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={isActive ? 1 : 0.25}
                style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
              />
            )
          })}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {CURVES.map((curve) => {
            const isActive = active === null || active === curve.id
            const isSelected = active === curve.id
            return (
              <button
                key={curve.id}
                onClick={() => setActive(active === curve.id ? null : curve.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                  isSelected
                    ? 'border-foreground/30 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-foreground/20'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: curve.color }}
                />
                {viz?.curves?.[curve.label as keyof typeof viz.curves] ?? curve.id}
              </button>
            )
          })}
        </div>
      </div>
    </FadeUp>
  )
}
