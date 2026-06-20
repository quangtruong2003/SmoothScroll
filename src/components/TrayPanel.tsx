import { useEffect, useState, useCallback, useRef } from 'react';
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
import { applyTheme } from '../lib/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AppSettings } from '@/lib/tauri';
import { Switch } from '@/components/ui/switch';
import { CurrentAppCard } from './tray/CurrentAppCard';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[0.77rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

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
    default: 'text-foreground hover:bg-accent active:bg-accent',
    destructive: 'text-destructive hover:bg-accent active:bg-accent',
    muted: 'text-muted-foreground hover:bg-accent active:bg-accent',
  };

  const baseClass = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${variantClasses[variant]}`;

  if (toggle !== undefined) {
    const isOn = checked ?? false;
    return (
      <label className={`${baseClass} cursor-pointer`}>
        {icon && (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
            {icon}
          </span>
        )}
        <span className="flex-1 text-left">{label}</span>
        <Switch checked={isOn} onCheckedChange={(v) => onToggle?.(v)} />
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClass}
    >
      {icon && (
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

export function TrayPanel() {
  const { t } = useTranslation();

  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const patch = useSettingsStore((s) => s.patch);

  const [enabled, setEnabledState] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');

  const startMinimized = settings?.start_minimized ?? false;

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

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]);

  const handleSetEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    await invoke('set_enabled', { enabled: v });
  }, []);

  const handleSetAutostart = useCallback(async (v: boolean) => {
    setAutostartState(v);
    await invoke('set_autostart', { enabled: v });
  }, []);

  const handleSetStartMinimized = useCallback((v: boolean) => {
    patch({ start_minimized: v });
  }, [patch]);

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
    <div
      ref={rootRef}
      className="tray-panel-root flex flex-col select-none overflow-hidden rounded-xl border bg-background/95 text-foreground shadow-2xl backdrop-blur"
    >
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
            className={`text-[0.77rem] font-medium transition-colors duration-300 ${
              enabled ? 'text-green-500' : 'text-muted-foreground'
            }`}
          >
            {enabled ? t('tray.status_on') : t('tray.status_off')}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto">

        {/* Current foreground app */}
        <CurrentAppCard />

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
            label={navigator.userAgent.includes('Linux')
              ? t('tray.start_with_system', 'Start with system')
              : t('tray.start_with_windows')}
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
        <span className="text-[0.77rem] text-muted-foreground">SmoothScroll</span>
        <span className="text-[0.77rem] text-muted-foreground">{appVersion}</span>
      </div>
    </div>
  );
}

export default TrayPanel;
