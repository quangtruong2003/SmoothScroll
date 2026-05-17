import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  MousePointer2,
  Monitor,
  Minimize2,
  Settings,
  LayoutGrid,
  FileText,
  Power,
} from 'lucide-react';
import type { AppSettings, ThemeMode } from '../lib/tauri';
import { applyTheme } from '../lib/theme';

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full
        transition-colors duration-200 focus:outline-none focus:ring-2
        focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
        ${checked ? 'bg-primary' : 'bg-muted'}
      `}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow-md
          transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  toggle,
  checked,
  onToggle,
  onClick,
  variant = 'default',
}: {
  icon?: React.ReactNode;
  label: string;
  toggle?: boolean;
  checked?: boolean;
  onToggle?: (v: boolean) => void;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'muted';
}) {
  const variantClasses = {
    default: 'text-foreground hover:bg-accent active:bg-accent',
    destructive: 'text-destructive hover:bg-accent active:bg-accent',
    muted: 'text-muted-foreground hover:bg-accent active:bg-accent',
  };

  return (
    <button
      onClick={() => {
        if (toggle && onToggle) {
          onToggle(!checked);
        } else if (onClick) {
          onClick();
        }
      }}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        text-sm font-medium transition-colors duration-150
        ${variantClasses[variant]}
      `}
    >
      {icon && (
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="flex-1 text-left">{label}</span>
      {toggle !== undefined && (
        <Toggle checked={toggle} onChange={onToggle!} />
      )}
    </button>
  );
}

export function TrayPanel() {
  const { t } = useTranslation();

  const [enabled, setEnabledState] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');

  useEffect(() => {
    invoke<boolean>('get_enabled').then(setEnabledState);
    invoke<boolean>('get_autostart').then(setAutostartState);
    invoke<string>('app_version').then(setAppVersion);
    invoke<AppSettings>('get_settings').then((s) => {
      setStartMinimized(Boolean(s?.start_minimized));
      applyTheme((s?.theme ?? 'System') as ThemeMode);
    });

    const unlistenEnabled = listen<boolean>('enabled-changed', (event) => {
      setEnabledState(Boolean(event.payload));
    });

    const unlistenSettings = listen<AppSettings>('settings-changed', (event) => {
      const s = event.payload;
      if (s?.start_minimized !== undefined) {
        setStartMinimized(Boolean(s.start_minimized));
      }
      if (s?.start_with_os !== undefined) {
        setAutostartState(Boolean(s.start_with_os));
      }
    });

    return () => {
      unlistenEnabled.then((u) => u()).catch(() => {});
      unlistenSettings.then((u) => u()).catch(() => {});
    };
  }, []);

  const handleSetEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    await invoke('set_enabled', { enabled: v });
  }, []);

  const handleSetAutostart = useCallback(async (v: boolean) => {
    setAutostartState(v);
    await invoke('set_autostart', { enabled: v });
  }, []);

  const handleSetStartMinimized = useCallback(async (v: boolean) => {
    setStartMinimized(v);
    const current = await invoke<AppSettings>('get_settings');
    const updated = { ...current, start_minimized: v };
    await invoke('save_settings', { settings: updated });
  }, []);

  const handleOpenSettings = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('show_main_window');
  }, []);

  const handleOpenExcludedApps = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('show_main_window');
    await invoke('navigate_to', { section: 'excluded-apps' });
  }, []);

  const handleOpenLog = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('open_log_dir');
  }, []);

  const handleQuit = useCallback(async () => {
    await invoke('close_tray_panel');
    await invoke('quit_app');
  }, []);

  return (
    <div className="tray-panel-root flex flex-col h-screen select-none overflow-hidden rounded-xl border bg-background/95 text-foreground shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold leading-none">SmoothScroll</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              enabled ? 'bg-green-500' : 'bg-muted-foreground'
            }`}
          />
          <span
            className={`text-[10px] font-medium transition-colors duration-300 ${
              enabled ? 'text-green-500' : 'text-muted-foreground'
            }`}
          >
            {enabled ? t('tray.status_on') : t('tray.status_off')}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Quick Access */}
        <SectionLabel>{t('tray.quick_access')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.smooth_scrolling')}
            toggle
            checked={enabled}
            onToggle={handleSetEnabled}
            icon={<MousePointer2 className="h-4 w-4" />}
          />
          <MenuItem
            label={t('tray.start_with_windows')}
            toggle
            checked={autostart}
            onToggle={handleSetAutostart}
            icon={<Monitor className="h-4 w-4" />}
          />
          <MenuItem
            label={t('tray.start_minimized')}
            toggle
            checked={startMinimized}
            onToggle={handleSetStartMinimized}
            icon={<Minimize2 className="h-4 w-4" />}
          />
        </div>

        {/* Actions */}
        <SectionLabel>{t('tray.actions')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.open_settings')}
            onClick={handleOpenSettings}
            icon={<Settings className="h-4 w-4" />}
          />
          <MenuItem
            label={t('tray.excluded_apps')}
            onClick={handleOpenExcludedApps}
            icon={<LayoutGrid className="h-4 w-4" />}
          />
          <MenuItem
            label={t('tray.open_log')}
            onClick={handleOpenLog}
            icon={<FileText className="h-4 w-4" />}
          />
        </div>

        {/* About */}
        <SectionLabel>{t('tray.about')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.quit')}
            onClick={handleQuit}
            variant="destructive"
            icon={<Power className="h-4 w-4" />}
          />
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-border">
        <span className="text-[10px] text-muted-foreground">SmoothScroll</span>
        <span className="text-[10px] text-muted-foreground">{appVersion}</span>
      </div>
    </div>
  );
}

export default TrayPanel;
