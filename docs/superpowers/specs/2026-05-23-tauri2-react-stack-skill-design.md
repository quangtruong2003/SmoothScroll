# Spec — `tauri2-react-stack` Skill

**Status:** Draft → Pending user review
**Date:** 2026-05-23
**Source project:** SmoothScroll (Tauri 2 + Rust + React desktop app)
**Target skill location:** `~/.claude/skills/tauri2-react-stack/SKILL.md` (global, user-level)

## Goal

Tạo một skill duy nhất, monolithic, mà Claude có thể invoke khi:

1. **Bootstrap** một dự án Tauri 2 + React/TypeScript mới từ đầu, hoặc
2. **Reference** patterns khi đang code một dự án tương tự (thêm command, thêm setting, thêm UI section, release version, v.v.).

Skill rút từ patterns đã được kiểm chứng trong codebase SmoothScroll. Mục đích là tái sử dụng cho các dự án desktop tương lai do cùng một tác giả phát triển — bao gồm cả app utility hệ thống (có OS hooks, tray, hotkey, WASM core) lẫn app Tauri thông thường.

## Success criteria

- [ ] Skill file tồn tại tại `~/.claude/skills/tauri2-react-stack/SKILL.md`.
- [ ] Frontmatter `name` + `description` đúng format Claude Code skill (YAML), trigger description đủ rõ để Claude tự invoke khi gặp dự án Tauri 2.
- [ ] Skill chia làm 3 phần rõ ràng: Quick-start, Pattern catalog, Optional system utility addendum.
- [ ] Mỗi pattern có: tên, trigger ("when to use"), code skeleton (Rust hoặc TypeScript thực tế từ codebase), gotchas (nếu có).
- [ ] Skill độ dài ~600-900 dòng — đủ để tự chứa mà không tham chiếu file external khi không cần.
- [ ] Code examples copy trực tiếp được hoặc adapt với thay đổi tối thiểu.
- [ ] Skill file pass syntax check của Claude Code (YAML frontmatter hợp lệ, không có placeholder TBD).
- [ ] Spec này được commit vào git trước khi triển khai.

## Non-goals

- Không tạo plugin Claude Code package.
- Không tạo template repository scaffold tool (skill chỉ chứa instructions + code skeleton, không generate code tự động).
- Không cover Linux build (codebase hiện chỉ build Windows + macOS).
- Không cover các framework frontend khác (Vue, Svelte, Solid).
- Không cover backend khác Tauri (Electron, Wails, Neutralino).
- Không bao gồm các pattern không có trong SmoothScroll codebase (no invented patterns).

## Skill structure

### Frontmatter

```yaml
---
name: tauri2-react-stack
description: Use when scaffolding or extending a Tauri 2 desktop app with React/TypeScript frontend and Rust backend. Covers bootstrap (pnpm + Vite + Tailwind + Radix + Zustand + i18next), IPC command pattern, threaded engine workers, ArcSwap hot-path snapshots, settings persistor, system tray, shadcn-style UI, Vitest tests, Conventional Commits + multi-channel release. Optional addendum for system-utility patterns (OS hooks, global hotkey, WASM core, accessibility gates).
---
```

### Part 1 — Quick-start

#### 1.1 Pinned stack table

| Layer | Package | Version |
|-------|---------|---------|
| Package manager | pnpm | 10.x |
| Frontend bundler | vite | ^6.1 |
| Frontend framework | react, react-dom | ^18.3 |
| Type system | typescript | ^5.7 |
| Styling | tailwindcss + postcss + autoprefixer | ^3.4 / ^8.5 / ^10.4 |
| UI primitives | @radix-ui/react-* | latest |
| State store | zustand | ^5.0 |
| i18n | i18next + react-i18next + i18next-browser-languagedetector | ^24 / ^15 / ^8 |
| Toast | sonner | ^2 |
| Icons | lucide-react | latest |
| Class utils | clsx, tailwind-merge, class-variance-authority | latest |
| Test | vitest + @testing-library/react + jsdom | ^4 / ^16 / ^29 |
| Lint | eslint + @typescript-eslint/* + eslint-plugin-react-* | ^9 / ^8 / latest |
| Commits | @commitlint/cli + @commitlint/config-conventional | ^21 |
| Desktop | @tauri-apps/api + @tauri-apps/cli | ^2.11 |
| Tauri plugins | plugin-updater, plugin-process, plugin-shell | ^2 |
| Rust crates | tauri 2, arc-swap 1, parking_lot, crossbeam-channel 0.5, tracing + tracing-subscriber + tracing-appender, directories, serde, anyhow, thiserror, uuid v4 |  |

#### 1.2 Folder layout

```
project-root/
├── src/                         # React frontend
│   ├── components/
│   │   ├── ui/                  # shadcn-style primitives (button, dialog, ...)
│   │   ├── settings/            # SettingRow + Section components
│   │   ├── onboarding/          # Wizard state machines
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
│   │   ├── hook_wiring.rs       # OS hook sinks (optional)
│   │   └── ...
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── scripts/                     # ESM .mjs release helpers
│   ├── version-bump.mjs
│   └── generate-updater-manifest.mjs
├── crates/                      # optional workspace crates
│   ├── core/                    # smoothscroll_core analog (WASM-friendly)
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

#### 1.3 Bootstrap commands

pnpm-first; nếu pnpm lỗi, fix lỗi pnpm thay vì fallback npm/yarn (theo memory `feedback-use-pnpm`).

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

# 6. Cargo dependencies (cd src-tauri)
cargo add arc-swap parking_lot crossbeam-channel \
  tracing tracing-subscriber tracing-appender \
  directories serde@1 serde_json anyhow thiserror \
  uuid --features v4
```

#### 1.4 Baseline configuration files

Liệt kê + cung cấp content cho:
- `commitlint.config.cjs` (extends `@commitlint/config-conventional`)
- `vite.config.ts` (alias `@/*` → `./src/*`, server.port = 1420, fixed for Tauri)
- `tailwind.config.ts` (darkMode `["class"]`, content `./src/**/*.{ts,tsx,html}`)
- `tsconfig.json` (strict, paths)
- `tauri.conf.json` (identifier, windows config, updater pubkey placeholder)
- `Cargo.toml` workspace setup (optional)

### Part 2 — Pattern catalog

Mỗi pattern format:

```
### Pattern name
**Trigger:** When ...
**Files:** ...
**Skeleton:** code
**Gotchas:** ...
```

#### Group A — Rust backend patterns

A.1 **AppState composition root**
- Trigger: when initializing the app
- Files: `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`
- Skeleton: `pub struct AppState { engine, settings: Arc<RwLock<...>>, effective: Arc<ArcSwap<...>>, enabled: Arc<AtomicBool>, persistor: Arc<SettingsPersistor>, ... }` + build trong `pub fn run()` + `tauri::Builder::default().manage(app_state.clone())`
- Gotcha: order of construction matters — engine_thread spawn sau AppState, hook install sau engine_thread

A.2 **Add Tauri command**
- Trigger: when frontend needs to call Rust
- Files: `src-tauri/src/commands.rs`, append vào `invoke_handler![]` ở `lib.rs`
- Skeleton:
  ```rust
  #[tauri::command]
  pub fn xxx<R: tauri::Runtime>(
      app: AppHandle<R>,
      state: State<'_, Arc<AppState>>,
      arg: T,
  ) -> Result<U, String> {
      // 1. validate
      // 2. mutate state
      // 3. emit event (if state changed)
      // 4. persist (if applicable)
      Ok(result)
  }
  ```
- Gotcha: errors must serialize → use `String` or `serde`-able error type

A.3 **Canonical event emit helpers**
- Trigger: when state change must notify frontend windows
- Files: `commands.rs` top
- Skeleton:
  ```rust
  pub(crate) fn emit_settings_changed<R: tauri::Runtime>(app: &AppHandle<R>, s: &AppSettings) {
      let _ = app.emit("settings-changed", s.clone());
  }
  ```
- Gotcha: ignore Err — emit fails when no windows exist, that's fine

A.4 **Hot-path snapshot with ArcSwap**
- Trigger: settings read in hot loop (every wheel event)
- Files: `state.rs`, `engine_thread.rs`
- Skeleton: `effective: Arc<ArcSwap<EffectiveSettings>>` write rarely, read via `effective.load()` lock-free
- Gotcha: `ArcSwap::store` clones the whole `Arc<EffectiveSettings>` — keep EffectiveSettings small

A.5 **Background worker thread**
- Trigger: long-running work that shouldn't block IPC
- Files: `src-tauri/src/engine_thread.rs` (or similar)
- Skeleton:
  ```rust
  pub struct EngineThread { handle: JoinHandle<()> }
  impl EngineThread {
      pub fn spawn(state: Arc<AppState>) -> Self {
          let handle = std::thread::spawn(move || engine_loop(state));
          Self { handle }
      }
  }
  // wake via crossbeam-channel or state.engine_signal.signal()
  ```
- Gotcha: thread name via `Builder::new().name(...)`, drop semantics — use `OwnedHandles` RAII below

A.6 **OwnedHandles RAII cleanup**
- Trigger: managing OS handles/threads that must drop in order at app exit
- Files: `lib.rs`
- Skeleton:
  ```rust
  struct OwnedHandles {
      _engine: EngineThread,
      _hook: Option<HookHandle>,
      #[cfg(windows)] _timer: HighResTimerGuard,
  }
  // .manage(parking_lot::Mutex::new(Some(owned)))
  ```
- Gotcha: Tauri drops managed state at app exit, giving deterministic cleanup

A.7 **Debounced settings persistor**
- Trigger: settings change frequently but disk write is expensive
- Files: `src-tauri/src/settings_persistor.rs`
- Skeleton: `SettingsPersistor::spawn()` returns `Arc<Self>`; channel-based, coalesces writes, atomic file write via tempfile + rename
- Gotcha: directory comes from `directories::ProjectDirs::from("com", "<Org>", "<App>")`

A.8 **Tray init**
- Trigger: app needs system tray
- Files: `src-tauri/src/tray.rs`
- Skeleton: `pub fn init<R: tauri::Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()>` called inside `.setup(...)`
- Required Cargo feature: `tauri = { features = ["tray-icon", "image-png"] }`
- Gotcha: macOS uses template image (B&W) — Windows uses colored icon

A.9 **Logging with tracing**
- Trigger: every project
- Files: `lib.rs` `init_logging()`
- Skeleton: `tracing-appender::rolling::daily(log_dir, "<app>")` + non-blocking writer + `EnvFilter` + stdout+file layers
- Log dir: `directories::ProjectDirs(...).config_dir().join("logs")` (Windows) / `~/Library/Logs/<App>` (macOS)
- Prune logs > 7 days at startup

A.10 **CloseRequested → hide pattern**
- Trigger: tray-resident app, X button hides instead of quitting
- Skeleton: `win.on_window_event(|e| if let WindowEvent::CloseRequested { api, .. } = e { api.prevent_close(); win.hide(); })`

#### Group B — Frontend (TypeScript/React) patterns

B.1 **Typed IPC wrapper**
- Files: `src/lib/tauri.ts`
- Skeleton:
  ```ts
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  export async function getSettings(): Promise<AppSettings> {
    return invoke<AppSettings>('get_settings');
  }
  export function onSettingsChanged(cb: (s: AppSettings) => void): Promise<UnlistenFn> {
    return listen<AppSettings>('settings-changed', e => cb(e.payload));
  }
  ```

B.2 **Zustand settings store with IPC hydration**
- Files: `src/stores/settingsStore.ts`
- Skeleton: hydrate via `invoke('get_settings')` in init effect, subscribe `settings-changed` event, persist on change via debounce + `invoke('save_settings', { settings })`
- Gotcha: prevent feedback loop — when emit-driven update arrives, set a flag to skip the persist call

B.3 **Settings section component pattern**
- Files: `src/components/settings/<Name>Section.tsx`, `src/components/settings/SettingRow.tsx`
- Skeleton: `<SettingRow label="..." description="..." control={<Switch ... />} />` composed inside `<Section title="...">`

B.4 **shadcn-style primitive**
- Files: `src/components/ui/<name>.tsx`
- Skeleton: copy from shadcn docs, replace `cn` import with `@/lib/utils`, use `class-variance-authority` for variants, no shadcn CLI runtime
- Standard primitives: button, card, dialog, input, label, scroll-area, select, separator, slider, switch, tabs, toast, tooltip

B.5 **i18n key**
- Files: `src/i18n/index.ts` (resources) + component usage
- Skeleton: add key to en/vi/zh resource objects, use `const { t } = useTranslation()` + `t('section.key')`
- Gotcha: language change triggers Tauri command `change_language` so backend persists user choice

B.6 **Theme system**
- Files: `src/lib/theme.ts`
- Skeleton: detect OS theme via `window.matchMedia('(prefers-color-scheme: dark)')`, toggle `dark` class on `<html>`, sync from settings

B.7 **Vitest test colocated**
- Files: `<feature>.test.ts(x)` next to source
- Skeleton: `import { describe, it, expect } from 'vitest'` + `import { render, screen } from '@testing-library/react'`
- Config: `vite.config.ts` add `test: { environment: 'jsdom', setupFiles: ['./test-setup.ts'] }`

B.8 **Updater integration**
- Files: `src/lib/updater.ts`
- Skeleton: `import { check } from '@tauri-apps/plugin-updater'` + handle states (no-update / downloading / installed / error)
- Backend: `latest.json` (stable) + `beta.json` (beta) hosted on a static endpoint

B.9 **Onboarding wizard reducer**
- Files: `src/components/onboarding/wizardReducer.ts`, `OnboardingWizard.tsx`
- Skeleton: `useReducer` finite-state machine, persist progress via Tauri command `skip_onboarding`/`apply_onboarding_preset`

B.10 **Toast notifications**
- Files: any
- Skeleton: `import { toast } from 'sonner'` + `<Toaster />` mounted at App root

#### Group C — Release & CI patterns

C.1 **Conventional Commits + commitlint**
- Files: `commitlint.config.cjs`, `.github/workflows/commitlint.yml`
- Skeleton: extends `@commitlint/config-conventional`; CI workflow validates PR title + each commit

C.2 **SemVer 2.0.0 versioning + auto-bump**
- Files: `scripts/version-bump.mjs`
- Logic: read commit history since last tag, classify (feat → minor, fix → patch, breaking → major), write `package.json` + `src-tauri/Cargo.toml` + `tauri.conf.json`
- Gotcha: on Windows, use `execFileSync` instead of `execSync` to avoid shell parsing

C.3 **Multi-channel updater manifest**
- Files: `scripts/generate-updater-manifest.mjs`
- Output: `latest.json` (stable) + `beta.json` (beta) — generated from GitHub release artifacts + signature
- Channel detection: `src/lib/release-channel.ts` based on build flag

C.4 **Auto-release workflow**
- Files: `.github/workflows/release.yml`
- Triggers: tag push `v*.*.*` (stable) or `v*.*.*-beta.*` (beta)
- Matrix: windows-latest + macos-latest (universal-apple-darwin)
- Steps: install, build, sign (Tauri updater), upload artifacts, generate manifest, publish

C.5 **Pre-release local verification**
- Per user memory `build-locally-before-push`: run `npx tauri build` locally and hand off exe path before any release-triggering push.

C.6 **Keep a Changelog**
- Files: `CHANGELOG.md`
- Sections: Unreleased + version blocks with Added/Changed/Fixed/Removed
- `VERSIONING.md` documents the SemVer + Conventional Commits policy

### Part 3 — Optional addendum: System utility patterns

Only consult this part when building a system utility (mouse/keyboard tweaker, window manager, system tray helper) with OS-level integration.

D.1 **Platform abstraction via traits**
- Files: optional workspace crate `crates/platform/`
- Skeleton: define traits (`MouseHook`, `KeyboardScrollHook`, `Hotkey`, `WindowGeometry`, `FullscreenDetector`, `ProcessQuery`, `Autostart`, `Accessibility`) — implement per OS via `#[cfg(windows)]` / `#[cfg(target_os = "macos")]`
- Gotcha: trait objects must be `Send + Sync` for use in `Arc<AppState>`

D.2 **Global hotkey registration**
- Files: `commands.rs` `register_hotkey_internal`
- Skeleton: drop previous handle first, then register new accelerator, store in `Arc<Mutex<Option<HotkeyHandle>>>`
- Gotcha: validate accelerator string before registering

D.3 **Per-app profile assignment**
- Skeleton: foreground process query → category classifier → swap effective settings snapshot via ArcSwap
- Files: `commands.rs` `assign_app_profile`, `suggest_profile_for_app`

D.4 **Game mode watcher**
- Files: `src-tauri/src/game_mode.rs`
- Skeleton: `pub fn spawn(app: AppHandle, state: Arc<AppState>)` — polls fullscreen detector + known-games list, toggles `game_mode_active: AtomicBool`

D.5 **WASM core bridge**
- Files: `crates/core/` (wasm-bindgen), `scripts/build-wasm.{ps1,sh}`, `src/lib/engineWasm.ts`, `src/lib/engine-wasm/*.d.ts`
- Skeleton: build via `wasm-pack build --target web`, copy `*_bg.wasm` + `*.d.ts` into `src/lib/engine-wasm/`, load lazily in preview component
- Gotcha: Vite needs `wasm` asset handling; types are committed for IDE support

D.6 **macOS Accessibility permission gate**
- Files: `src/components/macos/PermissionGate.tsx`, backend `commands::accessibility_status` + `accessibility_request_prompt`
- Skeleton: check `is_accessibility_trusted(false)` on launch, show modal explaining why permission is needed, retry on focus

D.7 **High-res timer guard (Windows)**
- Skeleton: RAII struct calls `timeBeginPeriod(1)` on construct, `timeEndPeriod(1)` on drop — owned by `OwnedHandles`

D.8 **Reduce-motion watcher (macOS Accessibility)**
- Skeleton: subscribe to OS reduce-motion changes, re-commit effective settings + emit `reduce-motion-changed` to UI

D.9 **Beta channel badge**
- Files: `src/lib/release-channel.ts`, `src/components/BetaBadge.tsx`
- Skeleton: detect channel from build-time env, conditionally render badge

D.10 **Donate / support links**
- Files: `src/lib/donate.ts`, `src/components/settings/SupportSection.tsx`
- Skeleton: open external links via `@tauri-apps/plugin-shell` `open()`, never `window.open` (CSP)

## Plan to create the skill

1. Create folder `~/.claude/skills/tauri2-react-stack/`.
2. Write `SKILL.md` following the structure above. Use code blocks from real codebase (adapt minimally, never invent).
3. Verify YAML frontmatter syntax (manual check or `head -10`).
4. Smoke-test by invoking the skill in a new Claude Code session and confirming it loads.
5. (Optional) Commit a copy of skill into `docs/superpowers/skills/` of this repo as documentation.

## Risks and trade-offs

- **Monolithic file size:** ~600-900 dòng. Lớn nhưng vẫn dưới 1500-line ceiling Claude xử lý tốt. Nếu trong tương lai phình to → tách references/ folder.
- **Patterns fixed-in-time:** Khi codebase SmoothScroll thay đổi, skill có thể trôi xa. Mitigation: ghi nguồn (`source: SmoothScroll@<commit>`) trong frontmatter để dễ refresh.
- **Specific to author's stack:** pnpm + Conventional Commits + ArcSwap có thể không phù hợp mọi team. Skill rõ ràng nói "this stack" để Claude không impose lên project khác.

## Validation criteria

Khi skill được tạo xong, kiểm tra:

- [ ] Invoke skill trong Claude Code không error.
- [ ] Khi prompt "scaffold a Tauri 2 app with tray + settings", Claude reach for Part 1 + tray pattern A.8.
- [ ] Khi prompt "add a new setting field", Claude reach for B.2 + A.2 + A.4.
- [ ] Khi prompt "build a system utility for X", Claude reach for Part 3.
- [ ] Skill không reference file ngoài (self-contained).

## Open questions

None. Tất cả các quyết định đã được approve trong session brainstorming:

- Stack: Tauri 2 + Rust + React
- Mục đích: cả bootstrap + reference
- Structure: monolithic 1 file
- Domain emphasis: generic + optional system utility addendum
- Approach: Hybrid Quick-start + Pattern catalog + Optional addendum
- Location: global `~/.claude/skills/`

## Next step

Sau khi user approve spec → invoke `superpowers:writing-plans` để tạo implementation plan chi tiết (bước viết SKILL.md, smoke test, commit).
