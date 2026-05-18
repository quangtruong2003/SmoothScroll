'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const THEMES = ['Light', 'Dark', 'System'] as const
type Theme = typeof THEMES[number]

const THEMES_STYLES: Record<Theme, { bg: string; text: string; border: string }> = {
  Light: { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200' },
  Dark: { bg: 'bg-gray-900', text: 'text-gray-100', border: 'border-gray-700' },
  System: { bg: 'bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800', text: 'text-foreground', border: 'border-border' },
}

export function TrayPreview() {
  const [enabled, setEnabled] = useState(true)
  const [strength, setStrength] = useState(70)
  const [theme, setTheme] = useState<Theme>('Light')

  const themeStyle = THEMES_STYLES[theme]

  return (
    <div className={`w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden ${themeStyle.bg} ${themeStyle.text} ${themeStyle.border}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-inherit">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-from to-brand-to flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect width="16" height="16" rx="3" fill="white" fillOpacity="0.9" />
            <path d="M4 6h8M4 10h8" stroke="hsl(220 90% 65%)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">SmoothScroll</p>
          <p className="text-xs opacity-60">v1.0.0</p>
        </div>
        <Badge variant="outline" className="text-xs">Active</Badge>
      </div>

      {/* Body */}
      <div className="p-4 space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <label htmlFor="tray-enable-switch" className="text-sm cursor-pointer">Enable smoothing</label>
          <Switch
            id="tray-enable-switch"
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable smoothing"
          />
        </div>

        <Separator />

        {/* Strength */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Smoothing strength</span>
            <span className="text-sm font-mono font-semibold">{strength}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            disabled={!enabled}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-gradient bg-muted disabled:opacity-50"
            aria-label="Smoothing strength"
            style={{
              background: enabled
                ? `linear-gradient(to right, hsl(220 90% 65%) 0%, hsl(220 90% 65%) ${strength}%, hsl(var(--muted)) ${strength}%, hsl(var(--muted)) 100%)`
                : undefined,
            }}
          />
          <div className="flex justify-between text-xs opacity-60">
            <span>Responsive</span>
            <span>Glassy</span>
          </div>
        </div>

        <Separator />

        {/* Theme */}
        <div className="space-y-3">
          <span className="text-sm">Theme</span>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                aria-label={`Set theme to ${t}`}
                className={`px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                  theme === t
                    ? 'border-primary bg-primary/10'
                    : 'border-border opacity-60 hover:opacity-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Hotkey */}
        <div className="flex items-center justify-between">
          <span className="text-sm opacity-60">Toggle</span>
          <kbd className="px-2 py-1 rounded bg-muted/50 text-xs font-mono border border-border">Ctrl+Shift+S</kbd>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-inherit flex items-center justify-between">
        <button type="button" aria-label="Open settings" className="text-xs opacity-60 hover:opacity-100 transition-opacity">Settings…</button>
        <button type="button" aria-label="Quit application" className="text-xs opacity-60 hover:opacity-100 transition-opacity">Quit</button>
      </div>
    </div>
  )
}
