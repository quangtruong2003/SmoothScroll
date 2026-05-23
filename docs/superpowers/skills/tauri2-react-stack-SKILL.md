---
name: tauri2-react-stack
description: Use when scaffolding or extending a Tauri 2 desktop app with React/TypeScript frontend and Rust backend. Covers bootstrap (pnpm + Vite + Tailwind + Radix + Zustand + i18next), IPC command pattern, threaded engine workers, ArcSwap hot-path snapshots, settings persistor, system tray, shadcn-style UI, Vitest tests, Conventional Commits + multi-channel release. Optional addendum for system-utility patterns (OS hooks, global hotkey, WASM core, accessibility gates).
---

# Tauri 2 + React Stack

Production-grade patterns for building desktop apps with Tauri 2 (Rust backend) + React 18 (TypeScript frontend), distilled from the SmoothScroll codebase. Use this skill in two modes:

1. **Bootstrap** — scaffolding a new project from scratch (Part 1).
2. **Reference** — daily-driver pattern catalog (Part 2) and optional system-utility patterns (Part 3).

## Table of contents

- Part 1: Quick-start
  - 1.1 Pinned stack
  - 1.2 Folder layout
  - 1.3 Bootstrap commands
  - 1.4 Baseline configuration files
- Part 2: Pattern catalog
  - Group A: Rust backend
  - Group B: TypeScript/React frontend
  - Group C: Release & CI
- Part 3: Optional addendum — System utility patterns

## Operating principles

- **pnpm-first.** Never fall back to npm/yarn — fix the pnpm error.
- **Conventional Commits + SemVer 2.0.0 + Keep a Changelog 1.1.0.**
- **Build locally before pushing release tags** (`pnpm tauri build` → hand off the produced exe path).
- **Do NOT invent patterns.** If you need something not in this skill, search the SmoothScroll repo or ask before adding speculative code.

---

## Part 1 — Quick-start

### 1.1 Pinned stack

| Layer | Package | Version |
|-------|---------|---------|
| Package manager | `pnpm` | 10.x |
| Frontend bundler | `vite` | ^6.1 |
| Frontend framework | `react`, `react-dom` | ^18.3 |
| Type system | `typescript` | ^5.7 |
| Styling | `tailwindcss` + `postcss` + `autoprefixer` | ^3.4 / ^8.5 / ^10.4 |
| UI primitives | `@radix-ui/react-*` | latest |
| State store | `zustand` | ^5.0 |
| i18n | `i18next` + `react-i18next` + `i18next-browser-languagedetector` | ^24 / ^15 / ^8 |
| Toast | `sonner` | ^2 |
| Icons | `lucide-react` | latest |
| Class utils | `clsx`, `tailwind-merge`, `class-variance-authority` | latest |
| Test | `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` | ^4 / ^16 / ^6 / ^29 |
| Lint | `eslint` + `@typescript-eslint/*` + `eslint-plugin-react-*` | ^9 / ^8 / latest |
| Commits | `@commitlint/cli` + `@commitlint/config-conventional` | ^21 |
| Desktop | `@tauri-apps/api` + `@tauri-apps/cli` | ^2.11 |
| Tauri plugins | `tauri-plugin-updater`, `tauri-plugin-process`, `tauri-plugin-shell` | ^2 |
| Rust crates | `tauri` 2, `arc-swap` 1, `parking_lot`, `crossbeam-channel` 0.5, `tracing` + `tracing-subscriber` + `tracing-appender`, `directories`, `serde` 1, `serde_json`, `anyhow`, `thiserror`, `uuid` v4 | |

### 1.2 Folder layout

```
project-root/
├── src/                         # React frontend
│   ├── components/
│   │   ├── ui/                  # shadcn-style primitives (button, dialog, ...)
│   │   ├── settings/            # SettingRow + section components
│   │   ├── onboarding/          # Wizard state machines
│   │   ├── preview/             # WASM-driven previews (optional)
│   │   └── ...
│   ├── lib/
│   │   ├── tauri.ts             # IPC wrapper (invoke + listen)
│   │   ├── settings.ts          # AppSettings type + helpers
│   │   ├── store.ts             # shared store helpers
│   │   ├── theme.ts             # theme + OS preference
│   │   ├── i18n.ts              # i18next init
│   │   └── utils.ts             # cn() etc.
│   ├── stores/
│   │   └── settingsStore.ts     # Zustand store
│   ├── i18n/
│   │   └── index.ts             # locale resources (en/vi/zh)
│   ├── routes/                  # Page-level components
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs               # entry point + composition root
│   │   ├── commands.rs          # #[tauri::command] handlers
│   │   ├── state.rs             # AppState struct
│   │   ├── tray.rs              # system tray init
│   │   ├── settings_persistor.rs# debounced save worker
│   │   ├── engine_thread.rs     # background worker(s)
│   │   └── ...
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── scripts/                     # ESM .mjs release helpers
│   ├── version-bump.mjs
│   └── generate-updater-manifest.mjs
├── crates/                      # optional workspace crates
│   ├── core/                    # WASM-friendly domain core
│   └── platform/                # OS abstraction traits
├── docs/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml          # if multi-crate
├── tailwind.config.ts
├── vite.config.ts
├── commitlint.config.cjs
└── CLAUDE.md
```

### 1.3 Bootstrap commands

pnpm-first; if pnpm errors occur, fix the error rather than falling back to npm/yarn.

```bash
# 1. Scaffold Vite + React + TS
pnpm create vite@latest <app-name> --template react-ts
cd <app-name>

# 2. Tauri
pnpm add -D @tauri-apps/cli@^2
pnpm add @tauri-apps/api@^2 @tauri-apps/plugin-updater@^2 \
  @tauri-apps/plugin-process@^2 @tauri-apps/plugin-shell@^2
pnpm tauri init

# 3. UI + state + i18n
pnpm add zustand@^5 i18next@^24 react-i18next@^15 \
  i18next-browser-languagedetector@^8 \
  clsx tailwind-merge class-variance-authority \
  lucide-react sonner \
  @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-scroll-area \
  @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider \
  @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs \
  @radix-ui/react-tooltip

# 4. Tailwind
pnpm add -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p

# 5. Test + lint + commit lint
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  @commitlint/cli @commitlint/config-conventional

# 6. Cargo dependencies (from src-tauri/)
cargo add arc-swap parking_lot crossbeam-channel \
  tracing tracing-subscriber tracing-appender \
  directories serde@1 serde_json anyhow thiserror \
  uuid --features v4
```

### 1.4 Baseline configuration files

#### `commitlint.config.cjs`

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

#### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] },
});
```

#### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

#### `tsconfig.json` (key options)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vite.config.ts", "test-setup.ts"]
}
```

#### `src-tauri/Cargo.toml` (excerpt)

```toml
[package]
name = "<app>-app"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
parking_lot = "0.12"
anyhow = "1"
thiserror = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
tracing-appender = "0.2"
directories = "5"
uuid = { version = "1", features = ["v4"] }
arc-swap = "1"
crossbeam-channel = "0.5"

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = ["Win32_UI_WindowsAndMessaging"] }
```

---

## Part 2 — Pattern catalog

Each pattern follows the same shape:
- **Trigger:** when this pattern applies
- **Files:** where to put / modify code
- **Skeleton:** copy-pasteable code
- **Gotchas:** non-obvious pitfalls

### Group A — Rust backend

#### A.1 AppState composition root

**Trigger:** When initializing the app — every Tauri app needs a single shared state container.

**Files:** `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`

**Skeleton (state.rs):**

```rust
use arc_swap::ArcSwap;
use parking_lot::{Mutex, RwLock};
use std::sync::{atomic::AtomicBool, Arc};

pub struct AppState {
    pub settings: Arc<RwLock<AppSettings>>,
    pub effective: Arc<ArcSwap<EffectiveSettings>>,
    pub enabled: Arc<AtomicBool>,
    pub persistor: Arc<SettingsPersistor>,
    pub engine_signal: Arc<EngineSignal>,
    // platform handles (optional, see Part 3)
}

impl AppState {
    pub fn commit_settings(&self, settings: AppSettings) {
        let eff = EffectiveSettings::from_settings(&settings);
        self.effective.store(Arc::new(eff));
        *self.settings.write() = settings.clone();
        self.persistor.queue(settings);
    }
}
```

**Skeleton (lib.rs `run`):**

```rust
pub fn run() {
    init_logging();
    let loaded = settings::load();
    let app_state = Arc::new(AppState { /* … */ });
    app_state.commit_settings(loaded.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state.clone())
        .setup(move |app| {
            tray::init(app.handle(), app_state.clone())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_settings,
            commands::save_settings,
            /* … */
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
```

**Gotchas:**
- Build order matters: settings → AppState → workers → hooks. A worker that reads `effective` before `commit_settings` runs sees stale defaults.
- Use `Arc<Mutex<Option<HookHandle>>>` for handles that may be replaced (re-register).

#### A.2 Add Tauri command

**Trigger:** When the frontend needs to call Rust.

**Files:** `src-tauri/src/commands.rs` + register in `lib.rs` `invoke_handler![]`.

**Skeleton:**

```rust
#[tauri::command]
pub fn save_settings<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: tauri::State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<(), String> {
    // 1. validate
    if !settings.is_valid() { return Err("invalid settings".into()); }
    // 2. mutate state
    state.commit_settings(settings.clone());
    // 3. emit event so other windows reload
    emit_settings_changed(&app, &settings);
    Ok(())
}
```

**Gotchas:**
- Errors must serialize — return `String` or a `serde::Serialize` error type.
- Heavy work should be sent into a worker thread; don't block the IPC thread.
- Don't forget to register in `invoke_handler![…]` — silent runtime error otherwise.

#### A.3 Canonical event emit helpers

**Trigger:** When state changes must notify all open windows.

**Files:** Top of `src-tauri/src/commands.rs`.

**Skeleton:**

```rust
pub(crate) fn emit_settings_changed<R: tauri::Runtime>(app: &AppHandle<R>, s: &AppSettings) {
    let _ = app.emit("settings-changed", s.clone());
}
pub(crate) fn emit_enabled_changed<R: tauri::Runtime>(app: &AppHandle<R>, enabled: bool) {
    let _ = app.emit("enabled-changed", enabled);
}
```

**Gotchas:** Ignore the `Err` — emit fails when no windows exist, which is fine for a tray-resident app.

#### A.4 Hot-path snapshot with ArcSwap

**Trigger:** Settings read in a hot loop (every wheel event, every frame).

**Files:** `state.rs`, hot-loop callers (e.g. `engine_thread.rs`).

**Skeleton:**

```rust
// In AppState:
pub effective: Arc<ArcSwap<EffectiveSettings>>,

// Write (rare):
state.effective.store(Arc::new(EffectiveSettings::from_settings(&new_settings)));

// Read (hot path, lock-free):
let eff = state.effective.load();
let curve = eff.curve;
```

**Gotchas:**
- `ArcSwap::store` clones the whole `Arc<EffectiveSettings>` — keep that struct small (booleans, scalars, small enums).
- `load()` returns a `Guard` — call `.load_full()` if you need a real `Arc` to hold across `await` points.

#### A.5 Background worker thread

**Trigger:** Long-running work (hook event pump, scroll engine, watchdog) that shouldn't block IPC.

**Files:** `src-tauri/src/engine_thread.rs` (or `edge_scroll_thread.rs`, etc.)

**Skeleton:**

```rust
pub struct EngineThread {
    _join: std::thread::JoinHandle<()>,
}

impl EngineThread {
    pub fn spawn(state: Arc<AppState>) -> Self {
        let handle = std::thread::Builder::new()
            .name("engine".into())
            .spawn(move || engine_loop(state))
            .expect("spawn engine thread");
        Self { _join: handle }
    }
}

fn engine_loop(state: Arc<AppState>) {
    loop {
        state.engine_signal.wait_timeout(std::time::Duration::from_millis(16));
        if state.shutdown.load(std::sync::atomic::Ordering::Relaxed) { break; }
        let eff = state.effective.load();
        /* hot work */
    }
}
```

**Gotchas:**
- Wake via a `crossbeam-channel` or a dedicated signal (Condvar wrapper) — never busy-loop.
- Drop semantics: pair with **A.6 OwnedHandles** so cleanup is deterministic.

#### A.6 OwnedHandles RAII cleanup

**Trigger:** Multiple OS handles/threads must drop in order at app exit.

**Files:** `src-tauri/src/lib.rs`.

**Skeleton:**

```rust
struct OwnedHandles {
    #[allow(dead_code)] _engine: EngineThread,
    #[allow(dead_code)] _hook: Option<HookHandle>,
    #[cfg(windows)] #[allow(dead_code)] _timer: HighResTimerGuard,
}

let owned = OwnedHandles {
    _engine: engine_thread,
    _hook: hook_result.ok(),
    #[cfg(windows)] _timer: HighResTimerGuard::begin(1),
};

tauri::Builder::default()
    .manage(parking_lot::Mutex::new(Some(owned)))
    /* … */;
```

**Gotchas:** Tauri drops `manage`'d state at app exit, giving deterministic cleanup. Don't store handles directly in `AppState` — they'd be cloned across threads.

#### A.7 Debounced settings persistor

**Trigger:** Settings change frequently (sliders) but disk writes are expensive.

**Files:** `src-tauri/src/settings_persistor.rs`.

**Skeleton:**

```rust
use crossbeam_channel::{bounded, Sender};

pub struct SettingsPersistor { tx: Sender<AppSettings> }

impl SettingsPersistor {
    pub fn spawn() -> Self {
        let (tx, rx) = bounded::<AppSettings>(8);
        std::thread::Builder::new().name("settings-persistor".into()).spawn(move || {
            let mut last: Option<AppSettings> = None;
            loop {
                match rx.recv_timeout(std::time::Duration::from_millis(500)) {
                    Ok(s) => last = Some(s),
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        if let Some(s) = last.take() { write_atomic(&s); }
                    }
                    Err(_) => break,
                }
            }
        }).expect("spawn persistor");
        Self { tx }
    }
    pub fn queue(&self, s: AppSettings) { let _ = self.tx.try_send(s); }
}

fn write_atomic(s: &AppSettings) {
    let path = directories::ProjectDirs::from("com", "<Org>", "<App>")
        .unwrap().config_dir().join("settings.json");
    std::fs::create_dir_all(path.parent().unwrap()).ok();
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(s).unwrap()).ok();
    std::fs::rename(&tmp, &path).ok();
}
```

**Gotchas:** Atomic write via tempfile + rename, never write in place. `try_send` so the IPC thread never blocks on the persistor channel.

#### A.8 Tray init

**Trigger:** App needs a system tray (always-on apps).

**Files:** `src-tauri/src/tray.rs`. Cargo: `tauri = { features = ["tray-icon", "image-png"] }`.

**Skeleton:**

```rust
use tauri::{AppHandle, Manager, Runtime, menu::{Menu, MenuItem}, tray::TrayIconBuilder};

pub fn init<R: Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Enable", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle" => { /* flip state.enabled */ }
            "quit"   => { app.exit(0); }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
```

**Gotchas:** macOS uses a B&W template image; Windows uses a colored icon. Don't share one PNG without testing both platforms.

#### A.9 Logging with tracing + daily rolling files

**Trigger:** Every project.

**Files:** `src-tauri/src/lib.rs` `init_logging()`.

**Skeleton:**

```rust
fn init_logging() {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let log_path = log_dir();
    std::fs::create_dir_all(&log_path).ok();
    let file_appender = tracing_appender::rolling::daily(&log_path, "<app>");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);
    Box::leak(Box::new(guard)); // flush on normal exit

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,<app>=debug"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(false))
        .with(fmt::layer().with_writer(file_writer).with_ansi(false).with_target(false))
        .try_init().ok();
}

fn log_dir() -> std::path::PathBuf {
    let dirs = directories::ProjectDirs::from("com", "<Org>", "<App>").unwrap();
    #[cfg(target_os = "macos")]
    if let Some(home) = std::env::var_os("HOME") {
        return std::path::PathBuf::from(home).join("Library/Logs/<App>");
    }
    dirs.config_dir().join("logs")
}
```

Prune logs older than 7 days at startup (`std::fs::read_dir` + `metadata.modified()`).

#### A.10 CloseRequested → hide

**Trigger:** Tray-resident app — X button should hide, not quit.

**Skeleton (inside `.setup`):**

```rust
if let Some(win) = app.get_webview_window("main") {
    let win_clone = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_clone.hide();
        }
    });
    let _ = win.hide(); // silent boot
}
```

### Group B — Frontend (TypeScript/React)

#### B.1 Typed IPC wrapper

**Trigger:** Anywhere the frontend calls Rust.

**Files:** `src/lib/tauri.ts`.

**Skeleton:**

```ts
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppSettings } from './settings';

export const getSettings   = () => invoke<AppSettings>('get_settings');
export const saveSettings  = (settings: AppSettings) =>
  invoke<void>('save_settings', { settings });
export const setEnabled    = (enabled: boolean) =>
  invoke<void>('set_enabled', { enabled });

export const onSettingsChanged = (cb: (s: AppSettings) => void): Promise<UnlistenFn> =>
  listen<AppSettings>('settings-changed', e => cb(e.payload));
export const onEnabledChanged = (cb: (v: boolean) => void): Promise<UnlistenFn> =>
  listen<boolean>('enabled-changed', e => cb(e.payload));
```

**Gotchas:** Always type the generic — IPC payloads are `unknown` otherwise.

#### B.2 Zustand settings store with IPC hydration

**Files:** `src/stores/settingsStore.ts`.

**Skeleton:**

```ts
import { create } from 'zustand';
import { getSettings, saveSettings, onSettingsChanged } from '@/lib/tauri';
import { debounce } from '@/lib/debounce';
import type { AppSettings } from '@/lib/settings';

interface SettingsState {
  settings: AppSettings | null;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => void;
}

let suppressPersist = false;
const persist = debounce((s: AppSettings) => saveSettings(s), 250);

export const useSettings = create<SettingsState>((set, get) => ({
  settings: null,
  hydrate: async () => {
    const s = await getSettings();
    set({ settings: s });
    onSettingsChanged(remote => {
      suppressPersist = true;
      set({ settings: remote });
      queueMicrotask(() => { suppressPersist = false; });
    });
  },
  update: patch => {
    const cur = get().settings; if (!cur) return;
    const next = { ...cur, ...patch };
    set({ settings: next });
    if (!suppressPersist) persist(next);
  },
}));
```

**Gotchas:** Without `suppressPersist`, the event from your own save will trigger another save → feedback loop.

#### B.3 Settings section pattern

**Files:** `src/components/settings/SettingRow.tsx`, `src/components/settings/<Name>Section.tsx`.

**Skeleton (SettingRow.tsx):**

```tsx
import { ReactNode } from 'react';

export function SettingRow({ label, description, control }: {
  label: ReactNode; description?: ReactNode; control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
```

**Skeleton (BehaviorSection.tsx):**

```tsx
import { useSettings } from '@/stores/settingsStore';
import { Switch } from '@/components/ui/switch';
import { SettingRow } from './SettingRow';
import { useTranslation } from 'react-i18next';

export function BehaviorSection() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  if (!settings) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{t('settings.behavior.title')}</h2>
      <SettingRow
        label={t('settings.behavior.invertDir')}
        description={t('settings.behavior.invertDirHint')}
        control={
          <Switch
            checked={settings.invertDirection}
            onCheckedChange={v => update({ invertDirection: v })}
          />
        }
      />
    </section>
  );
}
```

#### B.4 shadcn-style primitive

**Files:** `src/components/ui/<name>.tsx`. Required primitives at minimum: `button`, `card`, `dialog`, `input`, `label`, `scroll-area`, `select`, `separator`, `slider`, `switch`, `tabs`, `toast`, `tooltip`.

**Skeleton (button.tsx):**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        ghost:   'hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-input hover:bg-accent',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3', lg: 'h-10 px-6' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);
```

**Skeleton (`src/lib/utils.ts`):**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

**Gotcha:** Don't pull in the shadcn CLI runtime — copy primitives directly so the dependency surface stays tight.

#### B.5 i18n key

**Files:** `src/i18n/index.ts` (resources) + component usage.

**Skeleton (index.ts):**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi }, zh: { translation: zh } },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
```

**Skeleton (component usage):**

```tsx
import { useTranslation } from 'react-i18next';
const { t, i18n } = useTranslation();
// t('settings.behavior.title')
// i18n.changeLanguage('vi'); invoke('change_language', { lang: 'vi' });
```

**Gotcha:** Mirror language change to the backend so settings can persist it (and so any backend-rendered strings stay in sync).

#### B.6 Theme system

**Files:** `src/lib/theme.ts`.

**Skeleton:**

```ts
export type Theme = 'light' | 'dark' | 'system';

export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const isDark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('dark', isDark);
}

export function watchOSTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
```

**Gotcha:** Only watch OS theme when the user-selected theme is `system`. Otherwise OS toggles trigger spurious repaints.

#### B.7 Vitest test colocated

**Files:** `<feature>.test.ts(x)` next to source.

**Skeleton (`debounce.test.ts`):**

```ts
import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('coalesces rapid calls into one trailing invocation', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a'); d('b'); d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledExactlyOnceWith('c');
    vi.useRealTimers();
  });
});
```

**Skeleton (`test-setup.ts`):**

```ts
import '@testing-library/jest-dom/vitest';
```

#### B.8 Updater integration

**Files:** `src/lib/updater.ts`, mounted from App root.

**Skeleton:**

```ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates() {
  try {
    const update = await check();
    if (!update) return { kind: 'up-to-date' as const };
    await update.downloadAndInstall();
    await relaunch();
    return { kind: 'installed' as const };
  } catch (e) {
    return { kind: 'error' as const, message: String(e) };
  }
}
```

**Gotcha:** `latest.json` (stable) + `beta.json` (beta) manifests must be signed. See C.3 below.

#### B.9 Onboarding wizard reducer

**Files:** `src/components/onboarding/wizardReducer.ts`, `OnboardingWizard.tsx`.

**Skeleton:**

```ts
export type Step = 'welcome' | 'preset' | 'permissions' | 'done';
export interface State { step: Step; preset?: string; }
export type Action =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'CHOOSE_PRESET'; preset: string };

const order: Step[] = ['welcome', 'preset', 'permissions', 'done'];

export function wizardReducer(state: State, action: Action): State {
  const idx = order.indexOf(state.step);
  switch (action.type) {
    case 'NEXT': return { ...state, step: order[Math.min(idx + 1, order.length - 1)] };
    case 'BACK': return { ...state, step: order[Math.max(idx - 1, 0)] };
    case 'CHOOSE_PRESET': return { ...state, preset: action.preset };
  }
}
```

Persist progress via Tauri commands `apply_onboarding_preset` / `skip_onboarding`.

#### B.10 Toast notifications

**Files:** App root + any call site.

**Skeleton:**

```tsx
// App.tsx
import { Toaster } from 'sonner';
// ...
<Toaster position="bottom-right" richColors />
```

```ts
import { toast } from 'sonner';
toast.success('Saved');
toast.error('Failed: ' + msg);
```

### Group C — Release & CI

#### C.1 Conventional Commits + commitlint

**Files:** `commitlint.config.cjs`, `.github/workflows/commitlint.yml`.

**Skeleton (workflow):**

```yaml
name: commitlint
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm commitlint --from=${{ github.event.pull_request.base.sha }} --to=HEAD
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `style`, `revert`.

#### C.2 SemVer 2.0.0 auto-bump

**Files:** `scripts/version-bump.mjs`, `package.json` script.

**Skeleton:**

```js
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0']).toString().trim();
const log = execFileSync('git', ['log', `${lastTag}..HEAD`, '--pretty=%s']).toString().split('\n');

let major = 0, minor = 0, patch = 0;
for (const msg of log) {
  if (/!:|BREAKING CHANGE/.test(msg)) major++;
  else if (/^feat(\(|:)/.test(msg)) minor++;
  else if (/^fix(\(|:)/.test(msg)) patch++;
}
const [cMaj, cMin, cPat] = lastTag.replace(/^v/, '').split('.').map(Number);
const next = major ? `${cMaj+1}.0.0` : minor ? `${cMaj}.${cMin+1}.0` : `${cMaj}.${cMin}.${cPat+1}`;
console.log(next);

// Write to package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
```

**Gotcha (Windows):** Use `execFileSync('git', [...])` — **not** `execSync('git ...')`. The string form invokes a shell and breaks on argument quoting.

#### C.3 Multi-channel updater manifest

**Files:** `scripts/generate-updater-manifest.mjs`, deployed to `latest.json` / `beta.json` endpoints.

**Skeleton (output shape):**

```json
{
  "version": "1.1.0",
  "notes": "See CHANGELOG.md",
  "pub_date": "2026-05-23T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<base64 minisig>",
      "url": "https://example.com/releases/v1.1.0/<app>_1.1.0_x64-setup.nsis.zip"
    },
    "darwin-universal": {
      "signature": "<base64 minisig>",
      "url": "https://example.com/releases/v1.1.0/<app>_universal.app.tar.gz"
    }
  }
}
```

Channel selection on the client side via `src/lib/release-channel.ts`:

```ts
export type Channel = 'stable' | 'beta';
export const channel: Channel =
  (import.meta.env.VITE_CHANNEL as Channel | undefined) ?? 'stable';
export const manifestUrl =
  channel === 'beta'
    ? 'https://example.com/releases/beta.json'
    : 'https://example.com/releases/latest.json';
```

#### C.4 Auto-release workflow

**Files:** `.github/workflows/release.yml`.

**Triggers:** Push tags `v*.*.*` (stable) or `v*.*.*-beta.*` (beta).

**Matrix:**

```yaml
strategy:
  matrix:
    include:
      - { os: windows-latest, target: x86_64-pc-windows-msvc }
      - { os: macos-latest,  target: universal-apple-darwin }
```

**Steps:** checkout → setup pnpm + node + rust → `pnpm install` → `pnpm tauri build --target ${{ matrix.target }}` → upload artifacts → after matrix completes, regenerate manifest → publish GitHub Release with assets.

**Gotcha:** Don't use `--` separator — `pnpm tauri build --target X` is correct; `pnpm tauri build -- --target X` was wrong on macOS (see SmoothScroll commit `b871a96`).

#### C.5 Pre-release local verification

Before pushing any release-triggering tag, run locally and hand off the exe path:

```bash
pnpm tauri build
# Windows: src-tauri/target/release/bundle/nsis/<App>_<ver>_x64-setup.exe
# macOS:   src-tauri/target/release/bundle/dmg/<App>_<ver>_universal.dmg
```

This catches build failures before they consume the cross-platform CI matrix budget.

#### C.6 Keep a Changelog 1.1.0

**Files:** `CHANGELOG.md`, `VERSIONING.md`.

**Skeleton (CHANGELOG.md):**

```markdown
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]
### Added
### Changed
### Fixed

## [1.0.0] - 2026-MM-DD
### Added
- Initial release.
```

`VERSIONING.md` documents the policy (which commit types bump which versions, channel rules, signing).

---

## Part 3 — Optional addendum: System utility patterns

Consult this part only when building a system utility (mouse/keyboard tweaker, window manager, tray helper) requiring OS-level integration. Skip otherwise — these patterns add complexity that a typical Tauri productivity app doesn't need.

#### D.1 Platform abstraction via traits

**Files:** Optional workspace crate `crates/platform/`.

**Skeleton:**

```rust
// crates/platform/src/traits.rs
use std::sync::Arc;

pub trait MouseHook: Send + Sync {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle, PlatformError>;
}
pub trait KeyboardScrollHook: Send + Sync {
    fn install(&self, sink: Arc<dyn KeyboardSink>) -> Result<HookHandle, PlatformError>;
}
pub trait Hotkey: Send + Sync {
    fn register(&self, accel: Accelerator, on_pressed: Box<dyn Fn() + Send + Sync>) -> Result<HotkeyHandle, PlatformError>;
}
pub trait FullscreenDetector: Send + Sync { fn is_fullscreen(&self) -> bool; }
pub trait ProcessQuery: Send + Sync { fn foreground(&self) -> Option<ProcessInfo>; }
pub trait Accessibility: Send + Sync {
    fn reduce_motion_enabled(&self) -> bool;
    fn watch(&self, cb: Box<dyn Fn(bool) + Send + Sync>) -> Result<WatchHandle, PlatformError>;
}

// crates/platform/src/lib.rs
pub fn current() -> anyhow::Result<Platform> {
    #[cfg(windows)]   return Ok(windows::build());
    #[cfg(target_os = "macos")] return Ok(macos::build());
    #[cfg(not(any(windows, target_os = "macos")))]
    anyhow::bail!("unsupported platform");
}
```

**Gotcha:** All trait objects stored in `AppState` must be `Send + Sync`.

#### D.2 Global hotkey registration

**Files:** `src-tauri/src/commands.rs`.

**Skeleton:**

```rust
pub(crate) fn register_hotkey_internal(state: &Arc<AppState>, accel: &str) -> Result<(), String> {
    if !is_valid_accelerator(accel) { return Err(format!("invalid accelerator '{accel}'")); }
    *state.hotkey_handle.lock() = None; // drop OS slot first
    let toggle_state = state.clone();
    let on_pressed: Box<dyn Fn() + Send + Sync> = Box::new(move || {
        let v = !toggle_state.enabled.load(Ordering::Relaxed);
        toggle_state.enabled.store(v, Ordering::Relaxed);
        toggle_state.engine_signal.signal();
    });
    state.hotkey
        .register(Accelerator { raw: accel.into() }, on_pressed)
        .map(|h| { *state.hotkey_handle.lock() = Some(h); })
        .map_err(|e| e.to_string())
}
```

**Gotcha:** Drop the previous handle **before** registering — Win32/macOS hotkey slots collide otherwise.

#### D.3 Per-app profile assignment

Foreground process query → category classifier → swap effective settings snapshot via ArcSwap.

```rust
let pid_info = state.processes.foreground();
let category = classify_app(&pid_info);
let preset = preset_for_category(category);
let eff_for_app = EffectiveSettings::with_profile(&state.settings.read(), &preset);
state.effective.store(Arc::new(eff_for_app));
```

#### D.4 Game mode watcher

**Files:** `src-tauri/src/game_mode.rs`.

**Skeleton:**

```rust
pub fn spawn<R: tauri::Runtime>(app: tauri::AppHandle<R>, state: Arc<AppState>) {
    std::thread::Builder::new().name("game-mode".into()).spawn(move || loop {
        let fs = state.fullscreen_detector.is_fullscreen();
        let known = state.settings.read().known_games.iter().any(|g| {
            state.processes.foreground().map(|p| p.exe == *g).unwrap_or(false)
        });
        let active = fs && known;
        if state.game_mode_active.swap(active, Ordering::Relaxed) != active {
            let _ = app.emit("game-mode-changed", active);
        }
        std::thread::sleep(std::time::Duration::from_secs(1));
    }).expect("spawn game-mode thread");
}
```

#### D.5 WASM core bridge

**Files:** `crates/core/` (with `wasm-bindgen`), `scripts/build-wasm.{ps1,sh}`, `src/lib/engineWasm.ts`, committed `src/lib/engine-wasm/*.d.ts`.

**Build script (PowerShell):**

```powershell
cd crates/core
wasm-pack build --target web --out-dir ../../src/lib/engine-wasm
```

**Load lazily in preview component:**

```ts
import init, { run_curve } from '@/lib/engine-wasm/<crate>_core';
let ready: Promise<void> | null = null;
export async function ensureWasm() { ready ??= init().then(() => undefined); return ready; }
```

**Gotcha:** Commit the generated `.d.ts` for IDE support; do not commit the `.wasm` binary if your CI rebuilds it.

#### D.6 macOS Accessibility permission gate

**Files:** `src/components/macos/PermissionGate.tsx`, backend `commands::accessibility_status` + `accessibility_request_prompt`.

**Skeleton (backend):**

```rust
#[tauri::command]
pub fn accessibility_status(state: State<'_, Arc<AppState>>) -> bool {
    #[cfg(target_os = "macos")]
    { state.accessibility.reduce_motion_enabled(); /* + AXIsProcessTrusted */ }
    #[cfg(not(target_os = "macos"))]
    { true }
}
```

**Skeleton (frontend):** Show modal on launch if `accessibility_status` is `false`, with a "Grant access" button that calls `accessibility_request_prompt` and re-checks on window focus.

#### D.7 High-res timer guard (Windows)

```rust
pub struct HighResTimerGuard;
impl HighResTimerGuard {
    pub fn begin(period_ms: u32) -> Self {
        unsafe { winapi::um::timeapi::timeBeginPeriod(period_ms); }
        Self
    }
}
impl Drop for HighResTimerGuard {
    fn drop(&mut self) { unsafe { winapi::um::timeapi::timeEndPeriod(1); } }
}
```

Owned by `OwnedHandles` (A.6) so the period is restored at app exit.

#### D.8 Reduce-motion watcher (macOS)

**Skeleton (inside `.setup`):**

```rust
let rm_handle = state.accessibility.watch(Box::new(move |new_value: bool| {
    state_clone.reduce_motion.store(new_value, Ordering::Relaxed);
    let snapshot = state_clone.settings.read().clone();
    state_clone.commit_settings(snapshot);
    let _ = tauri::Emitter::emit(&app_handle, "reduce-motion-changed", new_value);
}))?;
*state.rm_watch_handle.lock() = Some(rm_handle);
```

#### D.9 Beta channel badge

**Files:** `src/lib/release-channel.ts`, `src/components/BetaBadge.tsx`.

```tsx
import { channel } from '@/lib/release-channel';
export function BetaBadge() {
  if (channel !== 'beta') return null;
  return <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700">Beta</span>;
}
```

#### D.10 Donate / support links

```ts
// src/lib/donate.ts
import { open } from '@tauri-apps/plugin-shell';
export const openDonate = () => open('https://example.com/donate');
```

**Gotcha:** Never use `window.open` — Tauri's CSP forbids it. Always go through `@tauri-apps/plugin-shell`.

