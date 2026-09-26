# Game Mode Icons and Game Picker Design

**Date:** 2026-09-27

## Goal

Improve the Game Mode section's usability: each known-game chip shows the game's
icon, and adding a game becomes a searchable picker (click the input → dropdown
of games, click to add) instead of blind typing of an exe file name.

## Current state

- `GameModeSection.tsx` renders text-only chips (name + remove button), a free
  text `Input` and an `Add` button.
- Known games are stored as exe file names (`game_mode_known_apps`, e.g.
  `GTA5.exe`); matching happens by name, never by path.
- The backend already extracts icons: `windows-icons` → base64 PNG from an exe
  **path** (`crates/platform/src/icon.rs::extract_for_exe`), with a pid-keyed
  `IconCache` used only for the foreground app.
- `list_visible_processes()` already returns `ProcessInfo` including `exe_path`
  on Windows; the frontend-facing Tauri `ProcessInfo` type does not expose it.
- The default known-games list ships 28 games (`default_games_list()` in
  `crates/core/src/settings.rs`) which are present on machines where the game
  is not installed — those chips can have no locally extracted icon.
- macOS/Linux icon extraction returns `None` today; the frontend falls back to
  a Lucide icon.

## Behavior

### Chip icons

Icon resolution priority per chip:

1. **Bundled asset** keyed by canonical exe name (lowercase, no `.exe`) —
   covers the 28 default games identically on every machine.
2. **Backend-extracted** icon for non-bundled names resolved to an installed
   or running exe.
3. **Fallback**: generic Lucide `Gamepad2` icon when both fail (game not
   installed and not bundled, or extraction failure, or non-Windows).

Backend icon caching is positive-only (canonical name → base64). Failures are
cheap to retry (a hash-miss lookup, no scan, no extraction) so negative caching
is not needed.

### Game picker (replaces input + Add button)

- Clicking the input opens a dropdown (Popover) below it; the input itself acts
  as the filter; results render in a `ScrollArea`.
- Sources, deduped case-insensitively by exe file name:
  1. **Running apps** — visible processes, fetched fresh per open.
  2. **Installed apps** — Registry App Paths + Start Menu shortcut scan,
     cached once per app session (lazy on first use).
- Entries already in `game_mode_known_apps` are hidden from suggestions.
- Primary label: exe file name; secondary label: display name (shortcut name /
  window title) when available.
- **Click a result → adds it immediately** (through the existing
  `add_known_game` + store patch, keeping the case-insensitive duplicate guard).
- Typing a custom name and pressing **Enter** still adds it manually (games
  outside the catalog).
- The `Add` button is removed; the `IS_LINUX` placeholder behavior is kept.
- Dropdown rows show the same icon pipeline as chips (bundled map + already
  fetched backend icons), fallback `Gamepad2` — no extra icon requests.
- Empty state copy points at manual entry: "No match? Type the .exe name and
  press Enter." (i18n)
- Catalog fetch failure degrades to the same empty state (manual entry still
  works); the loading state never persists on error.

## Backend design

### New platform module: `crates/platform/src/installed_apps.rs`

```rust
pub struct InstalledApp {
    pub exe_name: String,             // file name, e.g. "GTA5.exe"
    pub display_name: Option<String>, // shortcut file stem when from Start Menu
    pub exe_path: PathBuf,
}

pub fn scan_installed_apps() -> Vec<InstalledApp>;
```

Windows implementation:

- **Registry App Paths**: enumerate default values of
  `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\*.exe`,
  the `WOW6432Node` variant, and the `HKCU` equivalent. Each default value is a
  full exe path; missing files are skipped.
- **Start Menu**: recursive scan of
  `%ProgramData%\Microsoft\Windows\Start Menu\Programs` and
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs` for `.lnk` files, parsed
  with the shell's own `IShellLinkW` COM parser. (An earlier revision used the
  pure-Rust `lnk` crate; it unwraps on malformed input and every release
  profile ships `panic = "abort"`, so one bad shortcut crashed the app —
  caught in UAT 2026-09-27 and replaced with the panic-free COM path.)
  Bounded: depth cap 5, entry cap 2000, symlink/junction (reparse-point)
  entries skipped. Unresolvable shortcuts are skipped silently.
- Dedup case-insensitively by exe file name (running catalog unaffected —
  dedup happens at merge time in the command layer).
- Non-Windows: returns an empty Vec.

New dependency: `winreg` (battle-tested registry read/enumerate wrapper) in
`crates/platform`; shortcut parsing uses the `windows` crate's `IShellLinkW`
(new features `Win32_UI_Shell`, `Win32_Storage_FileSystem`) — no new parser
dependency, and zero panics reachable from the scan.

### New Tauri commands (`src-tauri/src/commands.rs`)

```rust
pub struct GameCatalogEntry {
    pub exe_name: String,             // e.g. "GTA5.exe"
    pub display_name: Option<String>, // shortcut name / window title
}

get_game_catalog() -> Vec<GameCatalogEntry>
get_known_game_icons(names: Vec<String>) -> HashMap<String, Option<String>>
```

- `get_game_catalog`: merges the session-cached installed-apps scan with a
  fresh pass of running visible processes (which supply `exe_path` and window
  titles), deduped by canonical exe name. The installed scan runs lazily on
  first call and is stored in `AppState` (`Mutex<Option<…>>`).
- `get_known_game_icons`: for each requested name, resolve name → exe path via
  (a) running processes, then (b) the installed-apps cache; extract via the
  existing `extract_for_exe`; store successes in a new name-keyed cache in
  `AppState` (`Mutex<HashMap<String, String>>`). Names are canonicalized with
  the same rules as `AppSettings::canonicalize_process_name` on both the
  request and resolution sides. Unresolvable names return `null`.
- Non-Windows: catalog still returns running processes (names only); icons
  resolve to `null` and the frontend falls back.

## Frontend design

### `src/lib/gameIcons.ts` (new)

Explicit map of the 28 default games: canonical exe name → asset URL from
`src/assets/games/*.png`. One line per game; adding a default game means one
PNG + one map entry.

### `src/lib/tauri.ts`

Add `getGameCatalog()` and `getKnownGameIcons(names)` plus the
`GameCatalogEntry` type.

### `src/components/settings/GameModeSection.tsx` (rework)

- On mount: fetch backend icons for known games not covered by the bundled map
  (single `getKnownGameIcons` call; re-fetch only when the known list changes).
- Chips: 16×16 rounded icon (`<img>` with data-URL or bundled asset URL) +
  name; `Gamepad2` fallback; remove button unchanged.
- Picker: Popover anchored to the input; opens on focus/click; filter-as-you-
  type over `exe_name` + `display_name`; ScrollArea list; click adds; Enter
  adds manual text. Catalog fetched when the dropdown first opens (loading
  state inside the list).
- Settings store: unchanged (`game_mode_known_apps` already exists; the
  debounced save path is untouched).

### i18n

New `game_mode.*` keys (search placeholder, empty state, loading) added to all
14 locales.

## Bundled assets

- 28 PNGs, 48×48, each ≤ ~10 KB, total < ~200 KB installer impact.
- Sourcing: extracted from locally installed games where available; official
  public icons for the rest. Small identification use, same practice as OSS
  launchers (Playnite, Lutris). The user reviews each icon at UAT; any icon is
  replaceable by dropping a new PNG in `src/assets/games/`.

## Testing

- **Rust** (unit, Windows-guarded where needed): canonical-name dedup/merge
  logic; App Paths default-value → path handling; Start Menu entry cap/depth
  bounds; name-keyed icon cache behavior (hit, miss, positive-only).
- **Vitest** (scope `src/`; landing/ has pre-existing unrelated failures):
  chip renders bundled `<img>`; chip renders backend icon after fetch; fallback
  when null; dropdown opens, lists catalog, hides known games; filter matches
  name and display name; click adds through `addKnownGame` + patch; Enter adds
  manual text; case-insensitive duplicate blocked.
- **User UAT** on a built app (established workflow — no computer-use).

## Files touched

- `crates/platform/src/installed_apps.rs` (new) + `lib.rs` mod wiring
- `crates/platform/Cargo.toml` (`lnk`, `windows-registry`)
- `src-tauri/src/commands.rs` (two commands + catalog/icon caches)
- `src-tauri/src/state.rs` (two cache fields)
- `src/components/settings/GameModeSection.tsx` (rework)
- `src/lib/gameIcons.ts` (new), `src/lib/tauri.ts`
- `src/assets/games/*.png` (28 new files)
- `src/i18n/locales/*.json` (new keys, 14 files)
- Tests: `GameModeSection.test.tsx` (new), platform/commands unit tests

## Out of scope

- Persisting icons or name→path mappings to disk (per-session cache only).
- Icon extraction on macOS/Linux.
- Launcher-library scans (Steam VDF, Epic manifests, GOG).
- Expanding or curating the default games list itself.

## Risks

- **Scan latency**: Start Menu walk is bounded (depth/entry caps) and runs
  once per session on a command thread; the UI shows a loading state.
- **Shortcut parse failures**: skipped silently; running apps remain a
  fallback source.
- **Bundled icon quality/licensing**: reviewed at UAT; single-file swaps.
- **WebView2 data-URL images**: pattern already used for the foreground-app
  icon; no new rendering risk.
