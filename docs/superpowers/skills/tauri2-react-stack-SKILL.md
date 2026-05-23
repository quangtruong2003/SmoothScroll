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
