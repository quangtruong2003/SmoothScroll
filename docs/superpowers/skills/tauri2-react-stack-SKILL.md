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
