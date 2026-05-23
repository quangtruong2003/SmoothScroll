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
