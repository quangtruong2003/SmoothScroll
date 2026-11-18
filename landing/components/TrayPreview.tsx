'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe, MousePointer2, Settings, Power } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { getTrayLabels, type Locale } from '@/lib/i18n/tray-labels'

type TrayState = 'running' | 'quitting' | 'closed'

interface TrayPreviewProps {
  locale: Locale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)
  const [enabled, setEnabled] = useState(true)
  const [appEnabled, setAppEnabled] = useState(true)
  const [pulseSettings, setPulseSettings] = useState(false)
  const [state, setState] = useState<TrayState>('running')
  const quitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pulseSettings) return
    const t = setTimeout(() => setPulseSettings(false), 300)
    return () => clearTimeout(t)
  }, [pulseSettings])

  useEffect(() => {
    return () => {
      if (quitTimerRef.current) clearTimeout(quitTimerRef.current)
    }
  }, [])

  const handleQuit = () => {
    if (state !== 'running') return
    setEnabled(false)
    setAppEnabled(false)
    setState('quitting')
    if (quitTimerRef.current) clearTimeout(quitTimerRef.current)
    quitTimerRef.current = setTimeout(() => {
      setState('closed')
      quitTimerRef.current = null
    }, 5000)
  }

  const handleReopen = () => {
    setState('running')
    setEnabled(true)
    setAppEnabled(true)
  }

  const statusOn = enabled && state !== 'closed'
  const dotClass = state === 'quitting'
    ? 'tray-status-dot-quitting'
    : statusOn
      ? 'tray-status-dot-on'
      : 'tray-status-dot-off'
  const textClass = statusOn ? 'tray-status-text-on' : 'tray-status-text-off'
  const statusText = statusOn ? labels.status_on : labels.status_off

  const isQuitting = state === 'quitting'
  const isClosed = state === 'closed'
  const profileValue = appEnabled ? labels.profile_default : labels.profile_disabled

  return (
    <div
      className={`tray-panel-root tray-panel-flex${isQuitting ? ' tray-quitting' : ''}`}
      data-testid="tray-preview"
    >
      <div className="tray-header">
        <span className="tray-header-title">{labels.header}</span>
        <div className="tray-header-status">
          <span className={`tray-status-dot ${dotClass}`} aria-hidden />
          <span className={`tray-status-text ${textClass}`}>{statusText}</span>
        </div>
      </div>

      {isClosed ? (
        <button
          type="button"
          onClick={handleReopen}
          className="tray-reopen-button"
        >
          {labels.reopen}
        </button>
      ) : (
        <div className="tray-content">
          <div className="tray-section">
            <div className="tray-row">
              <span className="tray-row-app-icon">
                <Globe className="h-3 w-3" />
              </span>
              <span className="tray-row-label">{labels.current_app}</span>
              <Switch
                checked={appEnabled}
                onCheckedChange={setAppEnabled}
                aria-label={labels.toggle_current_app}
                disabled={isQuitting}
              />
            </div>
            <div className="tray-row">
              <span className="tray-row-label text-xs text-muted-foreground">
                {labels.profile_label}: {profileValue}
              </span>
              <span className="tray-row-icon" aria-hidden="true">
                <ChevronDown className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="tray-divider" />

          <div className="tray-section">
            <div className="tray-row">
              <span className="tray-row-icon">
                <MousePointer2 className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.smooth_scrolling}</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label={labels.smooth_scrolling}
                disabled={isQuitting}
              />
            </div>
          </div>

          <div className="tray-divider" />

          <div className="tray-section tray-section-last">
            <button type="button" className={`tray-row tray-row-action tray-row-button border-0 bg-transparent p-0 text-left font-[inherit]${pulseSettings ? ' tray-row-pulse' : ''}`} onClick={() => setPulseSettings(true)}>
              <span className="tray-row-icon">
                <Settings className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.open_settings}</span>
            </button>
            <button type="button" className="tray-row tray-row-action tray-row-destructive tray-row-button border-0 bg-transparent p-0 text-left font-[inherit]" onClick={handleQuit}>
              <span className="tray-row-icon">
                <Power className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.quit}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
