'use client'

import { Globe, MousePointer2, Monitor, Settings, Power } from 'lucide-react'
import { getTrayLabels, type Locale } from '@/lib/i18n/tray-labels'

interface TrayPreviewProps {
  locale: Locale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)

  return (
    <div className="tray-panel-root tray-panel-flex" data-testid="tray-preview">
      <div className="tray-header">
        <span className="tray-header-title">{labels.header}</span>
        <div className="tray-header-status">
          <span className="tray-status-dot tray-status-dot-on" aria-hidden />
          <span className="tray-status-text tray-status-text-on">
            {labels.status_on}
          </span>
        </div>
      </div>

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
          </div>
          <div className="tray-row">
            <span className="tray-row-icon">
              <Monitor className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.start_with_windows}</span>
          </div>
        </div>

        <div className="tray-divider" />

        <div className="tray-section tray-section-last">
          <div className="tray-row tray-row-action">
            <span className="tray-row-icon">
              <Settings className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.open_settings}</span>
          </div>
          <div className="tray-row tray-row-action tray-row-destructive">
            <span className="tray-row-icon">
              <Power className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.quit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
