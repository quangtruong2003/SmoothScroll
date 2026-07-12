# Per-OS Versioned Releases

## Problem

Currently, all3 platforms (Windows, macOS, Linux) share a single version number (`1.19.5`) and are built/released together in one workflow. This is incorrect because:

1. macOS is a completely separate Swift menu bar app (not Tauri)
2. A Windows-only fix bumps the version for macOS and Linux unnecessarily
3. All platforms are blocked if one platform's build fails
4. Version numbers don't reflect actual changes per platform

## Solution

Split the release pipeline into3 independent workflows, one per OS, each with its own version tracking, build process, and GitHub release.

## Design

### 1. Version Management

**Version files (repo root):**
```
VERSION.windows    → "1.19.5"  (migrated from current)
VERSION.macos      → "1.0.0"   (fresh start)
VERSION.linux      → "1.0.0"   (fresh start)
```

**Version bump script (`scripts/version-bump.mjs`):**
- Add `--platform <windows|macos|linux>` flag
- Bump only the relevant version file + associated config files:
  - Windows: `VERSION.windows`, `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`
  - macOS: `VERSION.macos`, `crates/*/Cargo.toml`
  - Linux: `VERSION.linux`, `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`
- Keep conventional commits logic unchanged
- Add `--dry-run` flag for testing

**Tag format:**
- Windows: `win/v1.19.5`
- macOS: `mac/v1.0.0`
- Linux: `linux/v1.0.0`

**GitHub Release format:**
- Release name: `Windows v1.19.5`, `macOS v1.0.0`, `Linux v1.0.0`
- Each release contains artifacts for that OS only

### 2. Workflow Structure

#### `release-windows.yml`
- **Trigger:** push to `master`, paths:
  - `src-tauri/**`
  - `src/**`
  - `crates/**`
  - `scripts/**`
  - `package.json`
  - `VERSION.windows`
- **Jobs:**
  1. `_guard` — skip if `[skip release]` in commit message
  2. `build-wasm` — build WASM engine (shared with Linux)
  3. `test` — run Rust + TypeScript + script tests
  4. `bump` — version bump for Windows (`--platform windows`)
  5. `build-windows` — Tauri build, generate `latest-win.json`, upload to release `win/v{version}`
- **Retains:** current Windows build logic, NSIS/MSI packaging, Tauri updater manifest

#### `release-macos.yml`
- **Trigger:** push to `master`, paths:
  - `macos/**`
  - `crates/**`
  - `VERSION.macos`
- **Jobs:**
  1. `_guard` — skip if `[skip release]`
  2. `bump` — version bump for macOS (`--platform macos`)
  3. `build-macos` — build Rust engine + Swift app + package DMG, upload to release `mac/v{version}`
- **No WASM:** macOS uses Swift app, not Tauri
- **No Tauri updater:** DMG-only distribution

#### `release-linux.yml`
- **Trigger:** push to `master`, paths:
  - `src-tauri/**`
  - `src/**`
  - `crates/**`
  - `scripts/**`
  - `package.json`
  - `VERSION.linux`
- **Jobs:**
  1. `_guard` — skip if `[skip release]`
  2. `build-wasm` — build WASM engine
  3. `test` — run Rust + TypeScript + script tests
  4. `bump` — version bump for Linux (`--platform linux`)
  5. `build-linux` — Tauri build (release-fast), generate `latest-linux.json`, upload to release `linux/v{version}`
- **Tauri updater:** endpoint points to `latest-linux.json`

### 3. Updater Manifests

| Platform | Manifest file | Updater endpoint |
|----------|--------------|-----------------|
| Windows | `latest-win.json` | `https://github.com/.../releases/latest/download/latest-win.json` |
| macOS | N/A (DMG-only) | N/A |
| Linux | `latest-linux.json` | `https://github.com/.../releases/latest/download/latest-linux.json` |

**`src-tauri/tauri.conf.json` updater endpoint:**
- Default: `latest-win.json` (for Windows builds)
- Linux build: before `pnpm tauri build`, use `jq` or `node` to patch `tauri.conf.json` and replace the endpoint URL with `latest-linux.json`. This avoids maintaining separate config files.

### 4. Path-Based Triggers (Shared Code)

| Path change | Windows | macOS | Linux |
|-------------|---------|-------|-------|
| `crates/core/` | ✅ | ✅ | ✅ |
| `crates/platform/` | ✅ | ✅ | ✅ |
| `src/**` | ✅ | ❌ | ✅ |
| `src-tauri/**` | ✅ | ❌ | ✅ |
| `macos/**` | ❌ | ✅ | ❌ |
| `scripts/**` | ✅ | ❌ | ✅ |
| `package.json` | ✅ | ❌ | ✅ |
| `VERSION.windows` | ✅ | ❌ | ❌ |
| `VERSION.macos` | ❌ | ✅ | ❌ |
| `VERSION.linux` | ❌ | ❌ | ✅ |

### 5. Cleanup

Each workflow cleans up only its own old releases:
- `release-windows.yml` — delete old `win/v*` releases
- `release-macos.yml` — delete old `mac/v*` releases
- `release-linux.yml` — delete old `linux/v*` releases

### 6. Migration Plan

1. Create `VERSION.windows` = `1.19.5`, `VERSION.macos` = `1.0.0`, `VERSION.linux` = `1.0.0`
2. Modify `scripts/version-bump.mjs` — add `--platform` flag and `--dry-run`
3. Modify `scripts/generate-updater-manifest.mjs` — add `--linux-deb`, `--linux-appimage` flags
4. Create `release-windows.yml` from current `auto-release.yml` Windows logic
5. Create `release-macos.yml` from current `auto-release.yml` macOS logic
6. Create `release-linux.yml` from current `auto-release.yml` Linux logic
7. Delete `auto-release.yml`
8. Keep `ci.yml` unchanged (dry-run for feature branches)
9. Test on `ci/**` branches before merging

### 7. What Stays Unchanged

- `ci.yml` — dry-run builds for feature branches (builds all3 OS)
- `tests.yml` — test runner
- `commitlint.yml` — commit message validation
- `deploy-landing.yml` — landing page deployment
- WASM build process
- Test suite (Rust + TypeScript + scripts)

## Success Criteria

1. Each OS has independent version number
2. Build only triggers when relevant code changes
3. macOS and Linux releases don't block each other or Windows
4. Updater works correctly for Windows and Linux with separate manifests
5. No regression in existing Windows build process
6. Migration is backward-compatible (existing updater endpoints still work)
