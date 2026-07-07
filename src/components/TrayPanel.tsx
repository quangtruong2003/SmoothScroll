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
import { IS_LINUX, IS_MAC } from '@/lib/platform';
import type { AppSettings } from '@/lib/tauri';
import { Switch } from '@/components/ui/switch';
import { CurrentAppCard } from './tray/CurrentAppCard';

// Tray panel styling intentionally follows each platform's tray-menu
// convention rather than the broader web design system:
//
//   - macOS NSMenu / NSPopover: tight vertical rhythm (≈ 22px rows),
//     single-line text aligned to leading edge, status indicator uses
//     the system green/grey; section headers are uppercase & tighter.
//   - Linux Adwaita popover: 32px rows, status indicator uses libadwaita
//     accent, section headers are sentence-case but in caption weight.
//   - Windows: stays on the legacy Tailwind look (--panel-radius etc.)
//
// Each variant is implemented as a separate styled class so we don't
// fight the global tokens from index.css.

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
  const variantClasses = {
    default: 'menu-item-default',
    destructive: 'menu-item-destructive',
    muted: 'menu-item-muted',
  };

  const baseClass = `menu-item ${variantClasses[variant]}`;

  if (toggle !== undefined) {
    const isOn = checked ?? false;
    return (
      <label className={`${baseClass} menu-item-toggle`}>
        {icon && <span className="menu-item-icon">{icon}</span>}
        <span className="menu-item-label">{label}</span>
        <Switch checked={isOn} onCheckedChange={(v) => onToggle?.(v)} />
      </label>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {icon && <span className="menu-item-icon">{icon}</span>}
      <span className="menu-item-label">{label}</span>
    </button>
  );
}

export function TrayPanel() {
  const { t } = useTranslation();

  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);

  const [enabled, setEnabledState] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');

  useEffect(() => {
    invoke<boolean>('get_enabled').then(setEnabledState, () => {
      // ignore
    });
    invoke<boolean>('get_autostart').then(setAutostartState, () => {
      // ignore
    });
    invoke<string>('app_version').then(setAppVersion, () => {
      // ignore
    });
    if (!settings) void load();

    const unlistenEnabled = listen<boolean>('enabled-changed', (event) => {
      setEnabledState(Boolean(event.payload));
    });
    const unlistenSettings = listen<Partial<AppSettings>>('settings-changed', (event) => {
      const s = event.payload;
      if (s && typeof s.start_with_os === 'boolean') {
        setAutostartState(s.start_with_os);
      }
      if (s && typeof s.theme === 'string') {
        applyTheme(s.theme);
      }
    });

    return () => {
      void unlistenEnabled.then((u) => u());
      void unlistenSettings.then((u) => u());
    };
  }, [load]);

  // Auto-resize the tray window to fit content. The window is created with
  // a fixed height in tauri.conf.json; we shrink (or grow) it to match the
  // panel's natural height so adding/removing rows doesn't leave dead space
  // or clip content.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastSent = 0;
    const sync = (h: number) => {
      const rounded = Math.round(h);
      if (rounded === lastSent || rounded < 50) return;
      lastSent = rounded;
      void invoke('resize_tray_panel', {
        height: Math.round(rounded * window.devicePixelRatio),
      }).catch(() => {
        // ignore
      });
    };
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sync(entry.contentRect.height);
      }
    });
    obs.observe(el);
    // Initial sync after layout settles.
    requestAnimationFrame(() => sync(el.getBoundingClientRect().height));
    return () => obs.disconnect();
  }, []);

  // Apply theme once settings load and whenever the theme choice changes,
  // so the tray panel matches light/dark from the very first paint.
  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings]);

  const handleSetEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    await invoke('set_enabled', { enabled: v });
  }, []);

  const handleSetAutostart = useCallback(async (v: boolean) => {
    setAutostartState(v);
    await invoke('set_autostart', { enabled: v });
  }, []);

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

      {/* Scrollable content */}
      <div className="tray-content">

        {/* Current foreground app — hidden on Linux (no foreground app detection) */}
        {!IS_LINUX && <CurrentAppCard />}

        {/* Quick Access */}
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

      {/* Footer */}
      <div className="tray-footer">
        <span>SmoothScroll</span>
        <span>{appVersion}</span>
      </div>
    </div>
  );
}

export default TrayPanel;