# Tray Panel + Silent Startup Implementation Plan

> **For agenting workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the native OS tray menu with a custom floating panel (HerD Pro style) and implement silent startup (app starts hidden in tray).

**Architecture:** Rust backend manages a second Tauri WebView window ("tray-panel") positioned at the cursor on right-click. Frontend renders a React panel with toggle switches, action items, and section headers. Silent startup is achieved by hiding the main window on setup.

**Tech Stack:** Tauri 2.x, React 18, TypeScript, Tailwind CSS, i18next (existing project).

---

## File Map

| File | Action |
|------|--------|
| `src-tauri/Cargo.toml` | Add `window` crate for cursor position |
| `src-tauri/src/tray.rs` | Rewrite — remove native Menu, add panel window management |
| `src-tauri/src/commands.rs` | Add `show_main_window`, `navigate_to`, `quit_app`, `open_tray_panel`, `close_tray_panel` commands |
| `src-tauri/tauri.conf.json` | Add `tray-panel` window config; hide main window |
| `src-tauri/src/lib.rs` | Simplify setup — always hide main window; register new commands |
| `src/i18n/locales/en.json` | Add tray panel translations |
| `src/i18n/locales/vi.json` | Add tray panel translations |
| `src/i18n/locales/zh.json` | Add tray panel translations |
| `src/components/TrayPanel.tsx` | **Create** — the floating panel React component |
| `src/App.tsx` | Handle `navigate-to` event from tray |
| `src/lib/tauri.ts` | Add `openTrayPanel` and `closeTrayPanel` bindings |

---

## Task 1: Configure Tauri Windows + Add window Crate

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add `window` crate to Cargo.toml**

Open `src-tauri/Cargo.toml` and add `window` to dependencies:

```toml
[dependencies]
smoothscroll_core = { workspace = true }
smoothscroll_platform = { workspace = true }
tauri = { workspace = true, features = ["tray-icon", "image-png"] }
serde = { workspace = true }
serde_json = { workspace = true }
parking_lot = { workspace = true }
anyhow = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
tracing-appender = { workspace = true }
directories = { workspace = true }

[target.'cfg(windows)'.dependencies]
window = "0.49"
```

- [ ] **Step 2: Update `tauri.conf.json` — add tray-panel window and hide main**

Open `src-tauri/tauri.conf.json`. Replace the `windows` array (lines 13-25):

```json
"windows": [
  {
    "label": "main",
    "title": "SmoothScroll",
    "width": 900,
    "height": 640,
    "minWidth": 720,
    "minHeight": 520,
    "resizable": true,
    "fullscreen": false,
    "center": true,
    "visible": false,
    "focused": false
  },
  {
    "label": "tray-panel",
    "title": "",
    "width": 300,
    "height": 440,
    "resizable": false,
    "decorations": false,
    "transparent": true,
    "skipTaskbar": true,
    "alwaysOnTop": true,
    "visible": false,
    "focused": false,
    "url": "index.html"
  }
],
```

Also set `"devtools": true` in the `build` section for debugging.

---

## Task 2: Rewrite Rust Tray Module

**Files:**
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Rewrite `src-tauri/src/tray.rs`**

Replace the entire contents of `src-tauri/src/tray.rs` with:

```rust
//! System tray icon.
//!
//! - Left-click: toggle enabled/disabled
//! - Right-click: show the floating tray-panel window at cursor position
//!
//! The panel is a frameless WebView window rendered via React.

use crate::state::AppState;
use std::sync::Arc;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, PhysicalPosition,
};

const TRAY_ID: &str = "main";
const PANEL_LABEL: &str = "tray-panel";

/// Returns the tray icon image for the given enabled state.
fn icon_for<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Image<'static> {
    fn default_owned<R: Runtime>(app: &AppHandle<R>) -> Image<'static> {
        app.default_window_icon()
            .map(|img| Image::new_owned(img.rgba().to_vec(), img.width(), img.height()))
            .unwrap_or_else(|| unreachable!("default window icon missing"))
    }
    if enabled {
        default_owned(app)
    } else {
        let bytes: &[u8] = include_bytes!("../icons/tray-disabled.png");
        Image::from_bytes(bytes)
            .map(|img| Image::new_owned(img.rgba().to_vec(), img.width(), img.height()))
            .unwrap_or_else(|_| default_owned(app))
    }
}

/// Get the current cursor position using the `window` crate on Windows.
fn cursor_position() -> PhysicalPosition<i32> {
    #[cfg(windows)]
    {
        let pos = window::cursor::get_cursor_pos();
        PhysicalPosition::new(pos.x as i32, pos.y as i32)
    }
    #[cfg(not(windows))]
    {
        // Fallback: center of primary monitor
        PhysicalPosition::new(960, 540)
    }
}

/// Position the panel window near the cursor, clamped to the primary monitor.
fn position_panel_at_cursor<R: Runtime>(app: &AppHandle<R>, win: &tauri::WebviewWindow<R>) {
    let cursor = cursor_position();
    let panel_w = 300;
    let panel_h = 440;

    let screen_w = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.size().width as i32)
        .unwrap_or(1920);
    let screen_h = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.size().height as i32)
        .unwrap_or(1080);

    // Position: center horizontally at cursor, offset slightly upward
    let mut x = cursor.x - panel_w / 2;
    let mut y = cursor.y - 20;

    // Clamp to screen bounds
    if x + panel_w > screen_w {
        x = screen_w - panel_w - 8;
    }
    if x < 0 {
        x = 8;
    }
    if y + panel_h > screen_h {
        y = screen_h - panel_h - 8;
    }
    if y < 0 {
        y = 8;
    }

    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
}

/// Show the tray panel window at the cursor position.
fn show_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        position_panel_at_cursor(app, &win);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Hide the tray panel window.
fn hide_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        let _ = win.hide();
    }
}

pub fn init<R: Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let enabled = state.enabled.load(std::sync::atomic::Ordering::Relaxed);

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon_for(app, enabled))
        .show_menu_on_left_click(false)
        .on_tray_icon_event({
            let app = app.clone();
            let state = state.clone();
            move |_tray, event| {
                match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        // Left-click: toggle enabled
                        let new_enabled = !state.enabled.load(std::sync::atomic::Ordering::Relaxed);
                        state.enabled.store(new_enabled, std::sync::atomic::Ordering::Relaxed);
                        state.engine_signal.signal();
                        crate::commands::emit_enabled_changed(&app, new_enabled);

                        if let Some(tray) = app.tray_by_id(TRAY_ID) {
                            let _ = tray.set_icon(Some(icon_for(&app, new_enabled)));
                        }
                        tracing::info!(enabled = new_enabled, "tray left-click toggled");
                    }
                    TrayIconEvent::Click {
                        button: MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        // Right-click: toggle panel
                        if let Some(win) = app.get_webview_window(PANEL_LABEL) {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                                return;
                            }
                        }
                        show_tray_panel(&app);
                    }
                    _ => {}
                }
            }
        })
        .build(app)?;

    // Hide the panel when it loses focus (click outside)
    {
        let app_focus = app.clone();
        if let Some(win) = app.get_webview_window(PANEL_LABEL) {
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = win.hide();
                    let _ = app_focus; // suppress unused warning
                }
            });
        }
    }

    // Keep tray icon in sync with `enabled-changed` events.
    {
        let app_h = app.clone();
        app.listen("enabled-changed", move |event| {
            let new_enabled: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            if let Some(tray) = app_h.tray_by_id(TRAY_ID) {
                let _ = tray.set_icon(Some(icon_for(&app_h, new_enabled)));
            }
        });
    }

    Ok(())
}

/// Show the tray panel programmatically (called from frontend via command).
pub fn show_panel<R: Runtime>(app: &AppHandle<R>) {
    show_tray_panel(app);
}

/// Hide the tray panel programmatically.
pub fn hide_panel<R: Runtime>(app: &AppHandle<R>) {
    hide_tray_panel(app);
}
```

- [ ] **Step 2: Update `src-tauri/src/commands.rs` — add new commands**

Add these functions to `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn open_tray_panel<R: tauri::Runtime>(app: AppHandle<R>) {
    crate::tray::show_panel(&app);
}

#[tauri::command]
pub fn close_tray_panel<R: tauri::Runtime>(app: AppHandle<R>) {
    crate::tray::hide_panel(&app);
}

#[tauri::command]
pub fn show_main_window<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
pub fn navigate_to<R: tauri::Runtime>(app: AppHandle<R>, section: String) {
    let _ = app.emit("navigate-to", section);
}

#[tauri::command]
pub fn quit_app<R: tauri::Runtime>(app: AppHandle<R>) {
    app.exit(0);
}
```

- [ ] **Step 3: Register new commands in `src-tauri/src/lib.rs`**

Find `.invoke_handler()` and add the new commands:

```rust
.invoke_handler(tauri::generate_handler![
    commands::ping,
    commands::get_enabled,
    commands::set_enabled,
    commands::get_settings,
    commands::save_settings,
    commands::set_hotkey_enabled,
    commands::set_hotkey_accelerator,
    commands::list_running_processes,
    commands::add_excluded_app,
    commands::remove_excluded_app,
    commands::get_autostart,
    commands::set_autostart,
    commands::change_language,
    commands::accessibility_status,
    commands::accessibility_request_prompt,
    commands::app_version,
    commands::open_log_dir,
    commands::open_tray_panel,
    commands::close_tray_panel,
    commands::show_main_window,
    commands::navigate_to,
    commands::quit_app,
])
```

- [ ] **Step 4: Simplify setup in `src-tauri/src/lib.rs` — always hide main window**

Find the `setup` closure (around line 96). Replace it with:

```rust
.setup(move |app| {
    tray::init(app.handle(), state_for_setup.clone())?;

    if let Some(win) = app.get_webview_window("main") {
        let win_clone = win.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win_clone.hide();
            }
        });
        // Always hide main window — silent boot
        let _ = win.hide();
    }

    tracing::info!(
        "SmoothScroll ready (enabled={})",
        state_for_setup.enabled.load(Ordering::Relaxed)
    );
    Ok(())
})
```

Changes from before: removed `start_minimized` conditional — main window is always hidden on startup.

---

## Task 3: Add i18n Translations for Tray Panel

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `src/i18n/locales/zh.json`

- [ ] **Step 1: Add tray panel translations to `en.json`**

Add these keys to the root of `src/i18n/locales/en.json` (after the last existing key, before the closing `}`):

```json
,
"tray": {
  "quick_access": "Quick Access",
  "smooth_scrolling": "Smooth Scrolling",
  "start_with_windows": "Start with Windows",
  "start_minimized": "Start minimized",
  "actions": "Actions",
  "open_settings": "Open Settings",
  "excluded_apps": "Excluded Apps",
  "open_log": "Open Log File",
  "about": "About",
  "quit": "Quit SmoothScroll",
  "status_on": "ON",
  "status_off": "OFF"
}
```

- [ ] **Step 2: Add tray panel translations to `vi.json`**

```json
,
"tray": {
  "quick_access": "Truy cập nhanh",
  "smooth_scrolling": "Cuộn mượt",
  "start_with_windows": "Khởi động cùng Windows",
  "start_minimized": "Khởi động ẩn",
  "actions": "Thao tác",
  "open_settings": "Mở cài đặt",
  "excluded_apps": "Ứng dụng loại trừ",
  "open_log": "Mở file log",
  "about": "Giới thiệu",
  "quit": "Thoát SmoothScroll",
  "status_on": "BẬT",
  "status_off": "TẮT"
}
```

- [ ] **Step 3: Add tray panel translations to `zh.json`**

```json
,
"tray": {
  "quick_access": "快速访问",
  "smooth_scrolling": "平滑滚动",
  "start_with_windows": "开机启动",
  "start_minimized": "启动时最小化",
  "actions": "操作",
  "open_settings": "打开设置",
  "excluded_apps": "排除的应用",
  "open_log": "打开日志文件",
  "about": "关于",
  "quit": "退出 SmoothScroll",
  "status_on": "开",
  "status_off": "关"
}
```

---

## Task 4: Add TypeScript Bindings

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add new command bindings**

Add these functions to `src/lib/tauri.ts`:

```typescript
export async function openTrayPanel(): Promise<void> {
  await invoke('open_tray_panel');
}

export async function closeTrayPanel(): Promise<void> {
  await invoke('close_tray_panel');
}

export async function showMainWindow(): Promise<void> {
  await invoke('show_main_window');
}

export async function navigateTo(section: string): Promise<void> {
  await invoke('navigate_to', { section });
}

export async function quitApp(): Promise<void> {
  await invoke('quit_app');
}
```

---

## Task 5: Create TrayPanel Component

**Files:**
- Create: `src/components/TrayPanel.tsx`

- [ ] **Step 1: Create the TrayPanel component**

Create `src/components/TrayPanel.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/settingsStore';
import {
  invoke,
  getEnabled,
  setEnabled,
  getAutostart,
  setAutostart,
  closeTrayPanel,
} from '../lib/tauri';

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
  const lang = useSettingsStore((s) => s.language) || 'en';

  const [enabled, setEnabledState] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [appVersion, setAppVersion] = useState('0.1.0');

  useEffect(() => {
    getEnabled().then(setEnabledState);
    getAutostart().then(setAutostartState);

    invoke<string>('app_version').then((v) => setAppVersion(v));

    useSettingsStore.getState().load().then(() => {
      setStartMinimized(useSettingsStore.getState().settings.start_minimized);
    });
  }, []);

  const handleSetEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    await setEnabled(v);
  }, []);

  const handleSetAutostart = useCallback(async (v: boolean) => {
    setAutostartState(v);
    await setAutostart(v);
  }, []);

  const handleSetStartMinimized = useCallback(async (v: boolean) => {
    setStartMinimized(v);
    const current = useSettingsStore.getState().settings;
    await useSettingsStore.getState().save({ ...current, start_minimized: v });
  }, []);

  const handleOpenSettings = useCallback(async () => {
    await closeTrayPanel();
    await invoke('show_main_window');
  }, []);

  const handleOpenExcludedApps = useCallback(async () => {
    await closeTrayPanel();
    await invoke('show_main_window');
    await invoke('navigate_to', { section: 'excluded-apps' });
  }, []);

  const handleOpenLog = useCallback(async () => {
    await closeTrayPanel();
    await invoke('open_log_dir');
  }, []);

  const handleQuit = useCallback(async () => {
    await closeTrayPanel();
    await invoke('quit_app');
  }, []);

  return (
    <div
      className="flex flex-col h-screen select-none overflow-hidden"
      style={{
        background: 'rgba(24, 24, 27, 0.96)',
        borderRadius: '12px',
        border: '1px solid rgba(63, 63, 70, 0.6)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05)',
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
          <span className="text-[10px] text-zinc-500 mt-0.5">{t('settings.version')}</span>
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
```

---

## Task 6: Update App.tsx and CSS

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update `src/App.tsx` — handle navigate-to event and TrayPanel route**

Replace the contents of `src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { SettingsPage } from "./routes/Settings";
import { PermissionGate } from "./components/macos/PermissionGate";
import { TrayPanel } from "./components/TrayPanel";
import { tauri } from "./lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function App() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    // Determine which window this is
    const label = getCurrentWindow().label;
    setWindowLabel(label);

    tauri
      .accessibilityStatus()
      .then(setGranted)
      .catch(() => setGranted(true));
  }, []);

  // Tray panel window renders TrayPanel directly
  if (windowLabel === "tray-panel") {
    return <TrayPanel />;
  }

  // Main window
  if (granted === null) return null;
  if (!granted) return <PermissionGate onGranted={() => setGranted(true)} />;

  return <SettingsPage />;
}
```

- [ ] **Step 2: Update `src/index.css` — ensure panel renders correctly**

Ensure the body styles support transparent floating window:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

/* Tray panel custom scrollbar */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: #3f3f46;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #52525b;
}
```

---

## Task 7: Verify and Build

- [ ] **Step 1: Check Rust compilation**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: No errors related to `window` crate or tray code.

- [ ] **Step 2: Check TypeScript compilation**

```bash
npx tsc --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Run dev build**

```bash
npm run tauri dev
```

- [ ] **Step 4: Manual testing checklist**

| Test | Expected |
|------|----------|
| App starts | Window hidden, tray icon visible |
| Left-click tray | Toggle enabled, icon changes, no panel |
| Right-click tray | Panel appears near cursor |
| Click outside panel | Panel disappears |
| Panel → Smooth Scrolling toggle | Toggles state immediately |
| Panel → Open Settings | Panel closes, main window appears |
| Panel → Quit | App exits completely |
| Language = VI | Panel shows Vietnamese labels |
| Language = ZH | Panel shows Chinese labels |

- [ ] **Step 5: Build release**

```bash
npm run tauri build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: custom tray panel (Herd Pro style) + silent startup"
```

---

## Verification Checklist

| Check | Expected |
|-------|----------|
| App starts | Window hidden, tray icon visible |
| Left-click tray | Toggle enabled, icon changes, no panel |
| Right-click tray | Panel appears at cursor position |
| Click outside panel | Panel hides |
| Panel → Smooth Scrolling toggle | Toggles state, panel stays |
| Panel → Open Settings | Closes panel, shows main window |
| Panel → Quit | Closes app completely |
| Panel language | Reads from settings store, supports en/vi/zh |
| Window `visible: false` | Main window never flashes on startup |

---

## Self-Review

- [ ] Panel uses 300x440px, positioned at cursor, clamped to screen
- [ ] Panel disappears on click outside (window blur event)
- [ ] Main window is always hidden on startup (`visible: false`)
- [ ] Left-click tray toggles enabled without showing panel
- [ ] Right-click tray shows/hides panel (toggle behavior)
- [ ] Toggle items in panel work correctly via Tauri commands
- [ ] Action items close panel and perform action
- [ ] `window` crate added to Cargo.toml `[target.'cfg(windows)'.dependencies]`
- [ ] i18n translations added to all 3 locale files
- [ ] TrayPanel uses `useTranslation()` hook from existing i18n
- [ ] Dark theme matches Herd Pro style (zinc palette, blue accent, green status)
- [ ] Panel has custom scrollbar
- [ ] Quit button closes app via `quit_app` command
- [ ] `tray-panel` window has `transparent: true` and `decorations: false`
- [ ] `App.tsx` checks `window.label === "tray-panel"` to render correct component
