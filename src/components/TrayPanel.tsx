import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../lib/tauri';

function AppIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#18181B" />
      <rect x="6" y="6" width="20" height="20" rx="4" fill="#3B82F6" />
      <path d="M11 16h10M16 11v10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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
        focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900
        ${checked ? 'bg-blue-500' : 'bg-zinc-600'}
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {children}
      </span>
    </div>
  );
}

function IconScroll({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z" opacity=".4"/>
      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function IconWindows({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 3v5h7V0L0 3zm9 0v5h7V0L9 3z"/>
    </svg>
  );
}

function IconMinimize({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="7" width="10" height="2" rx="1"/>
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm6.32-1.906l-1.042-.578a5.5 5.5 0 00-.35-1.044l.63-.9.744.372a.5.5 0 00.612-.142l2.5-3a.5.5 0 00-.098-.726l-2.5-2.5a.5.5 0 00-.726.098l-1.5 2a.5.5 0 00.098.726l.78.78a5.5 5.5 0 00-1.044.35l-.578-1.042A.5.5 0 0012 3.5V2.5a.5.5 0 00-.5-.5H9a.5.5 0 00-.5.5v1a.5.5 0 00-.172.42l-1.042.578a5.5 5.5 0 00-1.044.35l-.9-.63a.5.5 0 00-.612.142l-2.5 3a.5.5 0 00.098.726l2.5 2.5a.5.5 0 00.726-.098l.78-.78a5.5 5.5 0 00.35 1.044l-.578 1.042A.5.5 0 006 11.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00.42-.172z"/>
    </svg>
  );
}

function IconApps({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 8a6 6 0 1112 0A6 6 0 012 8zm6-3a3 3 0 100 6 3 3 0 000-6zM4 5a4 4 0 118 0 4 4 0 01-8 0z"/>
    </svg>
  );
}

function IconLog({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 2h6v1H5V7zm0 2h4v1H5V9z"/>
    </svg>
  );
}

function IconQuit({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 3.5l7 4.5-7 4.5V10l5.5-3.5L5.5 3V3.5z"/>
      <rect x="3" y="2" width="1.5" height="12" rx="0.75"/>
    </svg>
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
    default: 'text-zinc-50 hover:bg-zinc-700 active:bg-zinc-600',
    destructive: 'text-red-400 hover:bg-zinc-700 active:bg-zinc-600',
    muted: 'text-zinc-400 hover:bg-zinc-700 active:bg-zinc-600',
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
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-zinc-400">
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
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    invoke<boolean>('get_enabled').then(setEnabledState);
    invoke<boolean>('get_autostart').then(setAutostartState);
    invoke<string>('app_version').then(setAppVersion);
    invoke<AppSettings>('get_settings').then((s) => {
      setStartMinimized(Boolean(s?.start_minimized));
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
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
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
    <div
      className="tray-panel-root flex flex-col h-screen select-none overflow-hidden"
      style={{
        background: 'rgba(24, 24, 27, 0.96)',
        borderRadius: 12,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(63, 63, 70, 0.5)' }}
      >
        <AppIcon size={28} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-50 leading-none">SmoothScroll</span>
          <span className="text-[10px] text-zinc-500 mt-0.5">{t('about.version')}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ backgroundColor: enabled ? '#4ade80' : '#52525b' }}
          />
          <span
            className="text-[10px] font-medium transition-colors duration-300"
            style={{ color: enabled ? '#4ade80' : '#52525b' }}
          >
            {enabled ? t('tray.status_on') : t('tray.status_off')}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>

        {/* Quick Access */}
        <SectionLabel>{t('tray.quick_access')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.smooth_scrolling')}
            toggle
            checked={enabled}
            onToggle={handleSetEnabled}
            icon={<IconScroll />}
          />
          <MenuItem
            label={t('tray.start_with_windows')}
            toggle
            checked={autostart}
            onToggle={handleSetAutostart}
            icon={<IconWindows />}
          />
          <MenuItem
            label={t('tray.start_minimized')}
            toggle
            checked={startMinimized}
            onToggle={handleSetStartMinimized}
            icon={<IconMinimize />}
          />
        </div>

        {/* Actions */}
        <SectionLabel>{t('tray.actions')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.open_settings')}
            onClick={handleOpenSettings}
            icon={<IconSettings />}
          />
          <MenuItem
            label={t('tray.excluded_apps')}
            onClick={handleOpenExcludedApps}
            icon={<IconApps />}
          />
          <MenuItem
            label={t('tray.open_log')}
            onClick={handleOpenLog}
            icon={<IconLog />}
          />
        </div>

        {/* About */}
        <SectionLabel>{t('tray.about')}</SectionLabel>
        <div className="px-2 pb-2 space-y-0.5">
          <MenuItem
            label={t('tray.quit')}
            onClick={handleQuit}
            variant="destructive"
            icon={<IconQuit />}
          />
        </div>

      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(63, 63, 70, 0.5)' }}
      >
        <span className="text-[10px] text-zinc-600">SmoothScroll</span>
        <span className="text-[10px] text-zinc-600">{appVersion}</span>
      </div>
    </div>
  );
}

export default TrayPanel;
