'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, MousePointer2, Monitor, Settings, Power } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { getTrayLabels, type Locale } from '@/lib/i18n/tray-labels'

type TrayState = 'running' | 'quitting' | 'closed'

interface TrayPreviewProps {
  locale: Locale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)
  const [enabled, setEnabled] = useState(true)
  const [autostart, setAutostart] = useState(true)
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
    setAutostart(false)
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
    setAutostart(true)
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
            <div className="tray-row">
              <span className="tray-row-icon">
                <Monitor className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.start_with_windows}</span>
              <Switch
                checked={autostart}
                onCheckedChange={setAutostart}
                aria-label={labels.start_with_windows}
                disabled={isQuitting}
              />
            </div>
          </div>

          <div className="tray-divider" />

          <div className="tray-section tray-section-last">
            <div
              className={`tray-row tray-row-action${pulseSettings ? ' tray-row-pulse' : ''}`}
              onClick={() => setPulseSettings(true)}
              role="button"
              tabIndex={0}
            >
              <span className="tray-row-icon">
                <Settings className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.open_settings}</span>
            </div>
            <div
              className="tray-row tray-row-action tray-row-destructive"
              onClick={handleQuit}
              role="button"
              tabIndex={0}
            >
              <span className="tray-row-icon">
                <Power className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.quit}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
