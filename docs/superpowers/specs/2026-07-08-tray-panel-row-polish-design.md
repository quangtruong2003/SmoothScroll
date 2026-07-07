# Tray Panel Row Polish + Real App Icon Design

**Date**: 2026-07-08
**Status**: Approved
**Goal**: Improve `CurrentAppCard` tray row UX with (1) tighter icon spacing, (2) category-prefixed label, (3) real foreground-app icon in place of generic Lucide icon.

Depends on: prior commit `8e96077` + `b5e130d` (Windows tray panel shrink-wrap).

## Problem

Three concrete pain points in the current `CurrentAppCard` (`src/components/tray/CurrentAppCard.tsx:91-99`):

1. **Wide icon-to-label gap.** `.tray-row` uses `grid-template-columns: 28px 1fr auto` with `gap: 0 10px` and `padding: 0 12px`. The 28px column holds a 16px-icon centered in it, producing ~18px edge-to-edge between icon and label (feels airy).

2. **No category hint in label.** Row reads e.g. just `Visual Studio Code` instead of `IDE: Visual Studio Code`. Users scan rapidly — telling IDE vs Browser vs Terminal from app names alone is error-prone.

3. **Generic Lucide icon.** The icon (`Globe`, `Code2`, etc.) is mapped from `suggested_category` at `CurrentAppCard.tsx:19-29`. Same icon for every app in the same category — Chrome and Firefox both show `Globe`. Loses identity.

Verified by reading `src/components/tray/CurrentAppCard.tsx`, `src/lib/tauri.ts`, `crates/platform/src/traits.rs`, `src-tauri/src/commands.rs`.

## Target Behavior

```
Before:
[ globe ]   Visual Studio Code                           [ switch ]

After:
[ VS ]   IDE: Visual Studio Code                        [ switch ]
```

Per row, on each platform:

| Platform | Icon source | Spacing (icon→label) |
|----------|-------------|----------------------|
| Windows  | Real app icon (extracted from .exe) + fallback Lucide | 6px edge-to-edge |
| macOS    | Real app icon (NSRunningApplication.icon) + fallback Lucide | 6px |
| Linux    | Lucide only (per scope) | 6px |

Label format on ALL platforms: `{category_label}: {prettify(process_name)}`, where `category_label` comes from `ForegroundAppContext.suggested_category_label` (localized already via `AppCategory::label()`).

Spacing change is **global** to `.tray-row` (affects all tray rows, not just `CurrentAppCard`), per the rule "touch only what you must" → user asked specifically about icon-on-tray-panel spacing, so we tune `.tray-row` only.

## Architecture

### A — Spacing & label format (frontend-only)

- CSS: `.tray-row` switches from `grid-template-columns: 28px 1fr auto; gap: 0 10px` to `grid-template-columns: 20px 1fr auto; gap: 0 6px; padding: 0 10px`. The icon slot shrinks 28→20 (still room for a 16px icon with 2px padding each side), gap shrinks 10→6, row-side padding shrinks 12→10 to keep margin balance. macOS/Linux `.tray-row` rules (e.g. `src/index.css:772-777`) may also tighten in the same module — touch only the base `.tray-row` block if it's defined once and platform overrides rely on it; otherwise audit and update only those blocks that override.
- TSX: `CurrentAppCard.tsx` renders label as `{category_label}: {displayName}` (e.g. `IDE: Visual Studio Code`). If `category_label` is null (unknown process), omit prefix and show only `{displayName}`.

### B — Real app icon (cross-platform backend + frontend adapter)

1. **Extend `ProcessInfo` (`crates/platform/src/traits.rs:59-63`)** — add `pid: u32` (already there) + `exe_path: Option<String>` (NEW). Implement platform-specific path lookup:
   - Windows: `GetForegroundWindow` → `GetWindowThreadProcessId` → `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` → `QueryFullProcessImageNameW` → `Some(path)`.
   - macOS: `NSWorkspace.shared.frontmostApplication` → `processIdentifier` + `bundleURL.path` (returns `.app` bundle path).
   - Linux: open `/proc/<pid>/exe` via `std::fs::read_link` → `Some(path)`.

2. **New trait method** `foreground_process_info(&self) -> Option<ProcessInfo>` — default impl returns None; Win/Mac/Linux override. Existing `foreground_process_name` + `foreground_process_id` methods stay (lower-level callers), new combined method wraps them.

3. **New crate `crates/platform/src/icon.rs`** — exposes `pub fn extract_icon_for(exe_path: &Path) -> Option<String>` (returns base64-PNG-no-prefix) plus `pub struct IconCache { Mutex<HashMap<u64, CachedIcon>> }` with `get_or_extract(pid, exe_path) -> Option<String>`. Platform branches:
   - **Windows**: `windows-icons = "0.3"` (already pure Rust, no extra C deps) → `get_icon_base64_by_path(path)`. Strip any `data:image/png;base64,` prefix the crate prepends — Rust stores raw base64.
   - **macOS**: `objc2-app-kit` (already used by Swift drop) → `NSRunningApplication.runningApplicationsWithBundleIdentifier(bundleId).first.icon` → render to `NSBitmapImageRep` → `representationUsingType(NSBitmapImageFileTypePNG, properties:&props)` → `base64EncodedString`.
   - **Linux**: returns `None`. Fallback to Lucide in frontend.

   `Cargo.toml` (in `crates/platform/Cargo.toml`) gains `windows-icons = { version = "0.3", optional = true }` with `target_os = "windows"` feature gate. Other platforms stay dep-free.

4. **`IconCache` key** = `pid` (process starts/changes get a new pid → fresh extract; same app on second foreground miss → cache hit). Cache size cap = 32 entries; LRU by `last_used` timestamp inside `Mutex` (no external LRU crate). Cap prevents unbounded growth if user switches foreground rapidly across many apps.

5. **`AppState` (`src-tauri/src/state.rs`)** gains `pub app_icon_cache: Arc<Mutex<IconCache>>`. Initialized in `AppState::new` (`src-tauri/src/lib.rs`).

6. **`ForegroundAppContext` (`src-tauri/src/commands.rs:730-737`)** gains `pub app_icon_base64: Option<String>` (raw base64, no `data:` prefix). Populated in `get_foreground_app_context` (line 743) — after computing `process_name`, call `state.app_icon_cache.lock().get_or_extract(pid_or_zero, exe_path_or_None)` and stash in struct.

7. **Frontend type (`src/lib/tauri.ts:112-118`)** — add `app_icon_base64?: string | null` to `ForegroundAppContext`.

8. **`CurrentAppCard.tsx`** — replace `<Icon className="h-4 w-4" />` with:

   ```tsx
   {ctx.app_icon_base64 ? (
     <img
       src={`data:image/png;base64,${ctx.app_icon_base64}`}
       className="tray-row-app-icon"
       alt=""
       draggable={false}
     />
   ) : (
     <Icon className="h-4 w-4" />
   )}
   ```

   Add CSS `.tray-row-app-icon { width: 16px; height: 16px; object-fit: contain; image-rendering: -webkit-optimize-contrast; }`.

   Label becomes `{category_label || ""}{category_label ? ": " : ""}{displayName}`.

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Tighten `.tray-row` (and `body[data-platform="mac"] .tray-row` if override exists) — single block edit unless platform overrides diverge. |
| `src/components/tray/CurrentAppCard.tsx` | Render `<img>` OR Lucide; render category-prefixed label. |
| `crates/platform/src/traits.rs` | `+ exe_path: Option<String>` on `ProcessInfo`; declare `foreground_process_info()` trait method with default None impl. |
| `crates/platform/src/windows.rs` | Implement `foreground_process_info()` via Win32 calls; add 5-line Win32 helper. |
| `crates/platform/src/macos.rs` | Implement via `NSWorkspace.frontmostApplication`. |
| `crates/platform/src/linux.rs` | Implement via `/proc/<pid>/exe` readlink. |
| `crates/platform/src/icon.rs` *(new)* | Cross-platform extractor + `IconCache`. |
| `crates/platform/src/lib.rs` | Re-export `icon` module. |
| `crates/platform/Cargo.toml` | `+ windows-icons = { version = "0.3", optional = true }` with feature gate. |
| `src-tauri/Cargo.toml` | No changes (windows-icons is in `platform` crate). |
| `src-tauri/src/state.rs` | `+ pub app_icon_cache: Arc<Mutex<IconCache>>` on `AppState`. |
| `src-tauri/src/lib.rs` | Initialize `IconCache::default()` in `AppState::new`. |
| `src-tauri/src/commands.rs` | `+ app_icon_base64: Option<String>` on `ForegroundAppContext`; populate in `get_foreground_app_context`. |
| `src/lib/tauri.ts` | `+ app_icon_base64?: string \| null` on `ForegroundAppContext`. |

**Estimated files touched**: ~13. **Estimated new code**: ~250 lines Rust + ~30 lines TSX + ~10 lines CSS.

## Test Plan

### Manual (per platform)

1. **Windows 10/11**:
   - Switch foreground: idle → Chrome → VS Code → Notepad → File Explorer (one by one).
   - Observe each tray panel open: real app icon (Chrome's circle, VS Code's blue chevron, File Explorer's folder) appears, NOT generic Lucide; icon sits ~6px from label; label format is `Browser: Google Chrome`, `IDE: Visual Studio Code`, `Office: Notepad`, `FileExplorer: File Explorer` (or platform-canonical localized label).
   - Re-open Chrome within 5s → should hit cache (no extract delay; same icon returns instantly).
   - Open unknown app (e.g. cmd.exe) → label becomes `Terminal: Command Prompt`, icon = real Windows terminal icon.
   - Open a process with no .exe icon (rare; e.g. some system services) → Lucide fallback.
2. **macOS** *(requires Honey to test)*: same as Windows, foreground between Safari, Xcode, Terminal, Finder.
3. **Linux** *(out-of-scope for real icon)*: foreground between Firefox, gedit, terminal. Should show Lucide icon (not crash, not blank).

### Automated

- `cargo check` (must compile on Windows + macOS + Linux triples).
- `cargo test` for any new unit tests (cache eviction, path-resolution mocks).
- `pnpm exec tsc --noEmit` — TSX must compile.
- `pnpm test` — no new test files written but existing tests must pass.

### Spec acceptance criteria

- **AC-1**: Visual app icon appears for ~all common apps on Windows + macOS (HTML rendered, no missing image).
- **AC-2**: Lucide icon falls back gracefully when extraction fails (unknown process, no icon in .exe, sandboxed macOS app).
- **AC-3**: Label format is `{Category}: {App Name}` for Known categories; bare `{App Name}` when `category_label` is null.
- **AC-4**: Icon-to-label gap reduced from ~18px to ~6px. Verified by visual inspection + measuring in DevTools (F12 → inspect `.tray-row-icon`).
- **AC-5**: Switching foreground to same app within 5 seconds uses cached icon (no perceptible delay).
- **AC-6**: 32+ different apps in quick succession don't leak memory (cache cap holds).
- **AC-7**: No regressions: macOS tray panel still 264px, Linux 268px, Windows auto-fits. (Prior spec ACs still hold.)
- **AC-8**: No new runtime deps on Linux. (windows-icons is Windows-only via target_os gate.)
- **AC-9**: Build green on all 3 platforms (Tauri compile + Vite build).

## Out of Scope

- Linux real icon extraction (XDG icon-theme resolution is non-trivial; defer to follow-up spec).
- Disk cache / persistent icon storage across app restarts.
- High-DPI icon variants > 64×64 (extracted at default size; upscale via CSS `image-rendering: -webkit-optimize-contrast`).
- Custom category overrides (user-defined icon for an app).
- Icon for the AppProfileAssignDialog list rows (separate UI; out of scope here).
