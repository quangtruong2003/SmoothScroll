import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  MousePointer2,
  Monitor,
  Settings,
  Power,
} from 'lucide-react';
import { applyTheme } from '../lib/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useForegroundApp } from '@/hooks/useForegroundApp';
import { IS_LINUX, IS_MAC } from '@/lib/platform';
import type { AppSettings } from '@/lib/tauri';
import { Switch } from '@/components/ui/switch';
import { CurrentAppCard } from './tray/CurrentAppCard';
import { ProfilePill } from './tray/ProfilePill';

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  toggle?: boolean;
  checked?: boolean;
  onToggle?: (v: boolean) => void;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'muted';
}

function MenuItem({
  icon,
  label,
  toggle,
  checked,
  onToggle,
  onClick,
  variant = 'default',
}: MenuItemProps) {
  const rowClass = `tray-row ${variant === 'destructive' ? 'tray-row-destructive' : ''}`;

  if (toggle !== undefined) {
    const isOn = checked ?? false;
    return (
      <div className={rowClass}>
        {icon && <span className="tray-row-icon">{icon}</span>}
        <span className="tray-row-label">{label}</span>
        <Switch checked={isOn} onCheckedChange={(v) => onToggle?.(v)} />
      </div>
    );
  }

  return (
    <div className={`${rowClass} tray-row-action`} onClick={onClick} role="button" tabIndex={0}>
      {icon && <span className="tray-row-icon">{icon}</span>}
      <span className="tray-row-label">{label}</span>
    </div>
  );
}

export function TrayPanel() {
  const { t } = useTranslation();
  const { ctx, refresh } = useForegroundApp();

  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);

  const [enabled, setEnabledState] = useState(false);
  const autostart = useSettingsStore((s) => s.settings?.start_with_os ?? false);
  const patch = useSettingsStore((s) => s.patch);

  useEffect(() => {
    invoke<boolean>('get_enabled').then(setEnabledState, () => {
      // ignore
    });
    if (!settings) void load();

    const unlistenEnabled = listen<boolean>('enabled-changed', (event) => {
      setEnabledState(Boolean(event.payload));
    });
    const unlistenSettings = listen<Partial<AppSettings>>('settings-changed', (event) => {
      const s = event.payload;
      if (s && typeof s.theme === 'string') {
        applyTheme(s.theme);
      }
    });

    return () => {
      void unlistenEnabled.then((u) => u());
      void unlistenSettings.then((u) => u());
    };
  }, [load]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastSentH = 0;
    let lastSentW = 0;
    const sync = (w: number, h: number) => {
      const roundedH = Math.round(h);
      const roundedW = Math.round(w);
      if (roundedH === lastSentH && roundedW === lastSentW) return;
      if (roundedH < 50) return;
      lastSentH = roundedH;
      lastSentW = roundedW;
      void invoke('resize_tray_panel', {
        width: Math.round(roundedW * window.devicePixelRatio),
        height: Math.round(roundedH * window.devicePixelRatio),
      }).catch(() => {
        // ignore
      });
    };
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sync(entry.contentRect.width, entry.contentRect.height);
      }
    });
    obs.observe(el);
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      sync(rect.width, rect.height);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings]);

  const handleSetEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    await invoke('set_enabled', { enabled: v });
  }, []);

  const handleSetAutostart = useCallback(async (v: boolean) => {
    patch({ start_with_os: v });
    await invoke('set_autostart', { enabled: v });
  }, [patch]);

  const handleOpenSettings = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('show_main_window');
  }, []);

  const handleQuit = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('quit_app');
  }, []);

  return (
    <div ref={rootRef} className="tray-panel-root tray-panel-flex">
      {/* Header */}
      <div className="tray-header">
        <span className="tray-header-title">SmoothScroll</span>
        <div className="tray-header-status">
          <span
            className={`tray-status-dot ${enabled ? 'tray-status-dot-on' : 'tray-status-dot-off'}`}
            aria-hidden
          />
          <span
            className={`tray-status-text ${enabled ? 'tray-status-text-on' : 'tray-status-text-off'}`}
          >
            {enabled ? t('tray.status_on') : t('tray.status_off')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="tray-content">
        {/* Current foreground app */}
        {!IS_LINUX && (
          <div className="tray-section">
            <CurrentAppCard ctx={ctx} refresh={refresh} />
            <ProfilePill ctx={ctx} />
          </div>
        )}

        {/* Toggles */}
        <div className="tray-section">
          <MenuItem
            label={t('tray.smooth_scrolling')}
            toggle
            checked={enabled}
            onToggle={handleSetEnabled}
            icon={<MousePointer2 className="h-4 w-4" />}
          />
          <MenuItem
            label={
              IS_LINUX
                ? t('tray.start_with_system')
                : IS_MAC
                  ? t('tray.start_with_macos', 'Start at Login')
                  : t('tray.start_with_windows', 'Start with Windows')
            }
            toggle
            checked={autostart}
            onToggle={handleSetAutostart}
            icon={<Monitor className="h-4 w-4" />}
          />
        </div>

        {/* Divider */}
        <div className="tray-divider" />

        {/* Actions */}
        <div className="tray-section tray-section-last">
          <MenuItem
            label={t('tray.open_settings')}
            onClick={handleOpenSettings}
            icon={<Settings className="h-4 w-4" />}
          />
          <MenuItem
            label={t('tray.quit')}
            onClick={handleQuit}
            variant="destructive"
            icon={<Power className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}

export default TrayPanel;
