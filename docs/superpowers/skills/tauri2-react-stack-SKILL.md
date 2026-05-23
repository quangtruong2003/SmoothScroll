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
