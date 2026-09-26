# Game Mode Icons and Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Known-game chips show the game's icon (bundled → extracted → generic fallback) and adding a game becomes a searchable picker (click the input → dropdown of running + installed games, click to add; Enter adds a manual name).

**Architecture:** A new platform module scans installed apps (Registry App Paths + Start Menu `.lnk` targets, session-cached). Two additive Tauri commands serve the catalog and per-name icons. The frontend replaces the input+Add row with a Radix Popover combobox and renders 16×16 chip icons with a three-level fallback. The 28 default games get bundled 48×48 PNG icons so fresh installs show real icons for not-installed games.

**Tech Stack:** Rust (windows-sys-based platform crate, `winreg`, `lnk`), Tauri 2 commands, React + Radix Popover + Tailwind, Vitest/RTL, i18next (14 locales).

**Spec:** `docs/superpowers/specs/2026-09-27-game-mode-icons-picker-design.md`

## Global Constraints

- Windows-first; macOS/Linux degrade to running-processes-only catalog and `null` icons (frontend falls back to the generic gamepad icon). Spec §Backend design.
- Bundled icons: 48×48 PNG (longest side), each ≤ ~10 KB, 28 files, total < ~200 KB. Spec §Bundled assets.
- No settings schema change: `game_mode_known_apps` shape and `CURRENT_SETTINGS_SCHEMA_VERSION` are untouched.
- Vitest runs are scoped to `src/` — `landing/` has pre-existing unrelated failures. Never run bare `npm test` expecting a fully green suite.
- Cargo commands MUST prefix `CARGO_TARGET_DIR=D:/SmoothScroll/target` (user policy: never build on C:).
- Commit messages: English, conventional (`feat:`/`test:`/`chore:`), written for the public in-app changelog (sync-changelog turns commits into release notes) — no dev-internal notes.
- New Rust deps are added only to `crates/platform/Cargo.toml` under the existing `[target.'cfg(windows)'.dependencies]` section: `lnk = "0.5"`, `winreg = "0.55"`.

---

### Task 1: Bundled default-game icons + `gameIcons.ts` map

**Files:**
- Create: `scripts/fetch-game-icons.mjs`
- Create: `src/assets/games/*.png` (28 files, produced by running the script + manual fetches)
- Create: `src/lib/gameIcons.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `gameIconFor(name: string): string | null` — canonical exe name (lowercase, `.exe` stripped) → bundled asset URL, `null` when not bundled. Later tasks import this from `@/lib/gameIcons`.

- [ ] **Step 1: Write the fetch script**

`scripts/fetch-game-icons.mjs`:

```js
// One-shot downloader for the bundled default-game icons (48x48 PNG).
// Steam titles come from the official Cloudflare CDN; the remaining titles
// are fetched manually at execution time (see the plan's Task 1 notes).
// Re-running the script skips existing files, re-runs the resize pass over
// oversized files, and exits non-zero listing any icon still missing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "assets", "games");
mkdirSync(outDir, { recursive: true });

const STEAM = {
  csgo: 730,
  cs2: 730,
  dota2: 570,
  apexlegends: 1172470,
  rainbowsix: 359550,
  pubg: 578080,
  gta5: 271590,
  rdr2: 1174180,
  eldenring: 1245620,
  cyberpunk2077: 1091500,
  witcher3: 292030,
  rocketleague: 252950,
  warframe: 230410,
  factorio: 427520,
  terraria: 105600,
  stardewvalley: 413150,
  ets2: 227300,
  ats: 270880,
  dishonored2: 403640,
};

// Not on Steam — fetch the official icon PNG manually and save it as
// src/assets/games/<name>.png before finishing this task.
const MANUAL = [
  "leagueoflegends",
  "valorant",
  "fortniteclient-win64-shipping",
  "minecraftlauncher",
  "javaw",
  "overwatch",
  "overwatch2",
  "wow",
  "ffxiv_dx11",
];

const FULL_LIST = [...Object.keys(STEAM), ...MANUAL];

const RESIZE_PS = (file) =>
  `Add-Type -AssemblyName System.Drawing; ` +
  `$src=[System.Drawing.Image]::FromFile('${file}'); ` +
  `$scale=[Math]::Min(48/$src.Width,48/$src.Height); ` +
  `if($scale -ge 1){$src.Dispose(); exit 0}; ` +
  `$w=[int]([Math]::Ceiling($src.Width*$scale)); $h=[int]([Math]::Ceiling($src.Height*$scale)); ` +
  `$bmp=New-Object System.Drawing.Bitmap($w,$h); ` +
  `$g=[System.Drawing.Graphics]::FromImage($bmp); ` +
  `$g.InterpolationMode='HighQualityBicubic'; ` +
  `$g.DrawImage($src,0,0,$w,$h); $g.Dispose(); $src.Dispose(); ` +
  `$bmp.Save('${file}',[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()`;

for (const [name, appId] of Object.entries(STEAM)) {
  const dest = join(outDir, `${name}.png`);
  if (existsSync(dest) && statSync(dest).size > 1024) continue;
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/logo.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(1, 4).toString("binary") !== "PNG") throw new Error("not a PNG");
    writeFileSync(dest, buf);
    console.log(`downloaded ${name}.png (${buf.length} bytes)`);
  } catch (err) {
    console.error(`FAILED ${name}: ${err.message}`);
  }
}

// Resize every oversized file to a 48px longest side.
for (const name of FULL_LIST) {
  const dest = join(outDir, `${name}.png`);
  if (!existsSync(dest)) continue;
  if (statSync(dest).size <= 20 * 1024) continue;
  execFileSync("powershell", ["-NoProfile", "-Command", RESIZE_PS(dest)]);
  console.log(`resized ${name}.png -> ${statSync(dest).size} bytes`);
}

const missing = FULL_LIST.filter((name) => {
  const dest = join(outDir, `${name}.png`);
  return !existsSync(dest) || statSync(dest).size < 1024;
});

if (missing.length > 0) {
  console.error(`\nStill missing (fetch manually):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("\nAll 28 icons present.");
```

- [ ] **Step 2: Run the script and fill the manual gaps**

Run: `node scripts/fetch-game-icons.mjs`
Expected: 19 Steam icons download; the script exits 1 listing the 9 `MANUAL` names.

For each of the 9, find the official game icon PNG (vendor press page, official site favicon/app icon — small identification-size asset) with a web search, save it as `src/assets/games/<name>.png`, then re-run the script until it prints `All 28 icons present.` and exits 0. If a clean official PNG cannot be found for a title, leave it missing and remove that title from `MANUAL` **and** from the `gameIcons.ts` map in Step 3 — the chip falls back to the generic gamepad icon (defined spec behavior, not a failure).

- [ ] **Step 3: Write `src/lib/gameIcons.ts`**

```ts
// Bundled icons for the default known-games list
// (crates/core/src/settings.rs::default_games_list). Keys are canonical exe
// names: lowercase, ".exe" stripped. Adding a default game = drop a 48x48 PNG
// in src/assets/games/ + one entry here. Games absent from this map get their
// icon extracted on the backend when installed/running, or fall back to a
// generic gamepad icon.
import apexlegends from "@/assets/games/apexlegends.png";
import ats from "@/assets/games/ats.png";
import csgo from "@/assets/games/csgo.png";
import cs2 from "@/assets/games/cs2.png";
import cyberpunk2077 from "@/assets/games/cyberpunk2077.png";
import dishonored2 from "@/assets/games/dishonored2.png";
import eldenring from "@/assets/games/eldenring.png";
import ets2 from "@/assets/games/ets2.png";
import factorio from "@/assets/games/factorio.png";
import fortniteclientWin64Shipping from "@/assets/games/fortniteclient-win64-shipping.png";
import gta5 from "@/assets/games/gta5.png";
import javaw from "@/assets/games/javaw.png";
import leagueoflegends from "@/assets/games/leagueoflegends.png";
import minecraftlauncher from "@/assets/games/minecraftlauncher.png";
import overwatch from "@/assets/games/overwatch.png";
import overwatch2 from "@/assets/games/overwatch2.png";
import pubg from "@/assets/games/pubg.png";
import rdr2 from "@/assets/games/rdr2.png";
import rocketleague from "@/assets/games/rocketleague.png";
import stardewvalley from "@/assets/games/stardewvalley.png";
import terraria from "@/assets/games/terraria.png";
import valorant from "@/assets/games/valorant.png";
import warframe from "@/assets/games/warframe.png";
import witcher3 from "@/assets/games/witcher3.png";
import wow from "@/assets/games/wow.png";
import dota2 from "@/assets/games/dota2.png";
import ffxivDx11 from "@/assets/games/ffxiv_dx11.png";
import rainbowsix from "@/assets/games/rainbowsix.png";

const gameIcons: Record<string, string> = {
  apexlegends,
  ats,
  csgo,
  cs2,
  cyberpunk2077,
  dishonored2,
  eldenring,
  ets2,
  factorio,
  "fortniteclient-win64-shipping": fortniteclientWin64Shipping,
  gta5,
  javaw,
  leagueoflegends,
  minecraftlauncher,
  overwatch,
  overwatch2,
  pubg,
  rdr2,
  rocketleague,
  stardewvalley,
  terraria,
  valorant,
  warframe,
  witcher3,
  wow,
  dota2,
  ffxiv_dx11: ffxivDx11,
  rainbowsix,
};

export function gameIconFor(name: string): string | null {
  const key = name.trim().replace(/\.exe$/i, "").toLowerCase();
  return gameIcons[key] ?? null;
}
```

(If Step 2 dropped any title, drop its import + entry here too.)

- [ ] **Step 4: Verify the map typechecks**

Run: `npx tsc --noEmit`
Expected: no errors (a missing asset file or a missing png module declaration would fail here — fix before committing).

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-game-icons.mjs src/assets/games src/lib/gameIcons.ts
git commit -m "feat: bundle default game-mode icons"
```

---

### Task 2: Platform installed-apps scanner

**Files:**
- Modify: `crates/platform/Cargo.toml` (add `lnk`, `winreg` under `[target.'cfg(windows)'.dependencies]`)
- Create: `crates/platform/src/installed_apps.rs`
- Modify: `crates/platform/src/lib.rs` (add `pub mod installed_apps;` next to the other module declarations)

**Interfaces:**
- Consumes: nothing new.
- Produces: `smoothscroll_platform::installed_apps::{InstalledApp, scan_installed_apps, dedup_by_exe_name, exe_file_name}` where

```rust
pub struct InstalledApp {
    pub exe_name: String,             // file name incl. extension, e.g. "GTA5.exe"
    pub display_name: Option<String>, // Start Menu shortcut file stem when known
    pub exe_path: PathBuf,
}
pub fn scan_installed_apps() -> Vec<InstalledApp>; // empty Vec on non-Windows
```

Task 3 relies on exactly these names/types.

- [ ] **Step 1: Add the dependencies**

In `crates/platform/Cargo.toml`, inside the existing `[target.'cfg(windows)'.dependencies]` section, add:

```toml
lnk = "0.5"
winreg = "0.55"
```

- [ ] **Step 2: Write the failing tests**

Create `crates/platform/src/installed_apps.rs` with the module docs, imports, and this test module at the bottom (the pure helpers compile on all platforms so the tests run everywhere):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn dedup_keeps_first_occurrence_case_insensitively() {
        let apps = vec![
            InstalledApp {
                exe_name: "GTA5.exe".into(),
                display_name: None,
                exe_path: PathBuf::from(r"C:\a\GTA5.exe"),
            },
            InstalledApp {
                exe_name: "gta5.exe".into(),
                display_name: Some("dup".into()),
                exe_path: PathBuf::from(r"C:\b\gta5.exe"),
            },
            InstalledApp {
                exe_name: "cs2.exe".into(),
                display_name: None,
                exe_path: PathBuf::from(r"C:\a\cs2.exe"),
            },
        ];
        let got = dedup_by_exe_name(apps);
        assert_eq!(got.len(), 2);
        assert_eq!(got[0].exe_name, "GTA5.exe");
        assert_eq!(got[0].display_name, None);
        assert_eq!(got[1].exe_name, "cs2.exe");
    }

    #[test]
    fn dedup_drops_empty_names() {
        let apps = vec![InstalledApp {
            exe_name: String::new(),
            display_name: None,
            exe_path: PathBuf::from(r"C:\a"),
        }];
        assert!(dedup_by_exe_name(apps).is_empty());
    }

    #[test]
    fn exe_file_name_returns_file_name_with_extension() {
        assert_eq!(
            exe_file_name(Path::new(r"C:\Games\Hades\Hades.exe")),
            Some("Hades.exe".to_string())
        );
        assert_eq!(exe_file_name(Path::new("cs2.exe")), Some("cs2.exe".to_string()));
        assert_eq!(exe_file_name(Path::new("")), None);
    }
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo test -p smoothscroll_platform installed_apps`
Expected: FAIL — `dedup_by_exe_name`, `exe_file_name`, `InstalledApp` not defined.

- [ ] **Step 4: Implement the module**

Complete `crates/platform/src/installed_apps.rs`:

```rust
//! Scan for installed apps (exe name -> path) to power the Game Mode game
//! picker and chip icons. Windows: Registry App Paths + Start Menu .lnk
//! targets. Other platforms return an empty list; the frontend falls back to
//! its generic icon and manual entry.

use std::path::Path;

#[derive(Debug, Clone)]
pub struct InstalledApp {
    /// exe file name incl. extension, preserving source casing, e.g. "GTA5.exe".
    pub exe_name: String,
    /// Human label when known (Start Menu shortcut file stem).
    pub display_name: Option<String>,
    pub exe_path: std::path::PathBuf,
}

/// File name of an exe path, e.g. "GTA5.exe". None for paths without a file name.
pub fn exe_file_name(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy().trim().to_string();
    (!name.is_empty()).then_some(name)
}

/// Dedup case-insensitively by exe file name, keeping the first occurrence
/// (callers pass running-process sources first for precedence). Empty names
/// are dropped.
pub fn dedup_by_exe_name(apps: Vec<InstalledApp>) -> Vec<InstalledApp> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(apps.len());
    for app in apps {
        if app.exe_name.is_empty() {
            continue;
        }
        if seen.insert(app.exe_name.to_lowercase()) {
            out.push(app);
        }
    }
    out
}

#[cfg(windows)]
pub fn scan_installed_apps() -> Vec<InstalledApp> {
    windows_impl::scan()
}

#[cfg(not(windows))]
pub fn scan_installed_apps() -> Vec<InstalledApp> {
    Vec::new()
}

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    const START_MENU_REL: &str = r"Microsoft\Windows\Start Menu\Programs";
    /// Bounds so a pathological Start Menu cannot stall the picker's first open.
    const MAX_SCAN_ENTRIES: usize = 2000;
    const MAX_SCAN_DEPTH: usize = 5;

    pub fn scan() -> Vec<InstalledApp> {
        let mut apps = app_paths_entries();
        apps.extend(start_menu_entries());
        dedup_by_exe_name(apps)
    }

    /// `HKLM` App Paths (native + WOW6432Node) and `HKCU`. Values are usually
    /// absolute; REG_EXPAND_SZ strings with unexpanded `%VAR%` simply fail the
    /// is-file check and are skipped.
    fn app_paths_entries() -> Vec<InstalledApp> {
        let mut out = Vec::new();
        for (hive, sub) in [
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths"),
            (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
        ] {
            let Ok(hive_key) = RegKey::predef(hive).open_subkey_with_flags(sub, KEY_READ) else {
                continue;
            };
            for subkey_name in hive_key.enum_keys().flatten() {
                let Ok(subkey) = hive_key.open_subkey_with_flags(&subkey_name, KEY_READ) else {
                    continue;
                };
                let Ok(target) = subkey.get_value::<String, _>("") else {
                    continue;
                };
                let path = PathBuf::from(target.trim());
                if !path.is_file() {
                    continue;
                }
                out.push(InstalledApp {
                    exe_name: subkey_name,
                    display_name: None,
                    exe_path: path,
                });
            }
        }
        out
    }

    fn start_menu_entries() -> Vec<InstalledApp> {
        let mut roots = Vec::new();
        if let Ok(pd) = std::env::var("ProgramData") {
            roots.push(PathBuf::from(pd).join(START_MENU_REL));
        }
        if let Ok(ad) = std::env::var("APPDATA") {
            roots.push(PathBuf::from(ad).join(START_MENU_REL));
        }
        let mut lnk_files = Vec::new();
        for root in &roots {
            collect_lnk_files(root, 0, &mut lnk_files);
        }
        lnk_files.truncate(MAX_SCAN_ENTRIES);

        let mut out = Vec::new();
        for lnk_path in lnk_files {
            let Some(target) = lnk_target(&lnk_path) else {
                continue;
            };
            if !target.is_file() {
                continue;
            }
            let Some(exe_name) = exe_file_name(&target) else {
                continue;
            };
            let display_name = lnk_path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string());
            out.push(InstalledApp {
                exe_name,
                display_name,
                exe_path: target,
            });
        }
        out
    }

    fn collect_lnk_files(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
        if depth > MAX_SCAN_DEPTH || out.len() >= MAX_SCAN_ENTRIES {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                collect_lnk_files(&path, depth + 1, out);
            } else if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("lnk")) {
                out.push(path);
                if out.len() >= MAX_SCAN_ENTRIES {
                    return;
                }
            }
        }
    }

    /// lnk 0.5 exposes these as struct fields; if the pinned version differs,
    /// adjust the two accessors only.
    fn lnk_target(path: &Path) -> Option<PathBuf> {
        let link = lnk::ShellLink::open(path).ok()?;
        let info = link.link_info.as_ref()?;
        let base = info.local_base_path.as_ref()?;
        Some(PathBuf::from(base))
    }
}

#[cfg(test)]
mod tests {
    // ... tests from Step 2 ...
}
```

Then wire the module in `crates/platform/src/lib.rs` alongside the other `pub mod` declarations:

```rust
pub mod installed_apps;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo test -p smoothscroll_platform installed_apps`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/platform/Cargo.toml crates/platform/src/installed_apps.rs crates/platform/src/lib.rs
git commit -m "feat: scan installed apps for the game picker"
```

---

### Task 3: Catalog + icon Tauri commands

**Files:**
- Modify: `src-tauri/src/commands.rs` (new section at the end of the file)
- Modify: `src-tauri/src/lib.rs` (register the two commands in `generate_handler!` next to `commands::add_known_game,`)

**Interfaces:**
- Consumes: `smoothscroll_platform::installed_apps::{InstalledApp, scan_installed_apps}` (Task 2), `smoothscroll_platform::icon::extract_for_exe`, `smoothscroll_core::settings::AppSettings::canonicalize_process_name`, `state.processes.list_visible_processes() -> Vec<ProcessInfo>` (existing trait method; `ProcessInfo` has `name`, `window_title`, `exe_path: Option<String>`).
- Produces (Tauri commands the frontend calls in Task 4):

```rust
get_game_catalog() -> Vec<GameCatalogEntry>            // { exe_name: String, display_name: Option<String> }
get_known_game_icons(names: Vec<String>) -> HashMap<String, Option<String>>  // keyed by the requested raw name
```

- [ ] **Step 1: Write the failing tests**

Append to the existing `#[cfg(test)] mod tests` at the bottom of `src-tauri/src/commands.rs`:

```rust
mod game_catalog_tests {
    use super::{
        merge_game_catalog, resolve_exe_path, GameCatalogEntry,
    };
    use smoothscroll_platform::installed_apps::InstalledApp;
    use smoothscroll_platform::traits::ProcessInfo;
    use std::path::PathBuf;

    fn installed(name: &str, path: &str) -> InstalledApp {
        InstalledApp {
            exe_name: name.into(),
            display_name: None,
            exe_path: PathBuf::from(path),
        }
    }

    fn running(name: &str, exe_path: Option<&str>) -> ProcessInfo {
        ProcessInfo {
            pid: 1,
            name: name.into(),
            window_title: String::new(),
            exe_path: exe_path.map(|s| s.to_string()),
        }
    }

    #[test]
    fn merge_puts_running_first_and_dedups_case_insensitively() {
        let installed = vec![installed("hades.exe", r"C:\g\hades.exe")];
        let running = vec![running("HadesII.exe", Some(r"C:\g\hades2.exe"))];
        let got = merge_game_catalog(&installed, &running);
        // Running first, then the not-yet-seen installed entry.
        assert_eq!(got[0].exe_name, "HadesII.exe");
        assert_eq!(got[1].exe_name, "hades.exe");
    }

    #[test]
    fn merge_hides_installed_entry_duplicate_of_running() {
        let installed = vec![installed("cs2.exe", r"C:\s\cs2.exe")];
        let running = vec![running("CS2.EXE", Some(r"C:\s\cs2.exe"))];
        let got = merge_game_catalog(&installed, &running);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].exe_name, "CS2.EXE");
        // window_title empty -> display_name stays None
        assert_eq!(got[0].display_name, None);
    }

    #[test]
    fn merge_drops_empty_names() {
        let installed = vec![InstalledApp {
            exe_name: String::new(),
            display_name: None,
            exe_path: PathBuf::from(r"C:\x"),
        }];
        let running = vec![running("   ", None)];
        assert!(merge_game_catalog(&installed, &running).is_empty());
    }

    #[test]
    fn resolve_prefers_running_exe_path_then_installed() {
        let installed = vec![installed("hades.exe", r"C:\g\hades.exe")];
        let running = vec![running("cs2.exe", Some(r"C:\s\cs2.exe"))];

        assert_eq!(
            resolve_exe_path("cs2.EXE", &installed, &running),
            Some(PathBuf::from(r"C:\s\cs2.exe"))
        );
        assert_eq!(
            resolve_exe_path("Hades.exe", &installed, &running),
            Some(PathBuf::from(r"C:\g\hades.exe"))
        );
        // Running process without an exe_path falls through to the scan.
        let no_path = vec![running("hades.exe", None)];
        assert_eq!(
            resolve_exe_path("hades.exe", &installed, &no_path),
            Some(PathBuf::from(r"C:\g\hades.exe"))
        );
        assert_eq!(resolve_exe_path("missing.exe", &installed, &running), None);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo test -p smoothscroll-app game_catalog_tests`
Expected: FAIL — `merge_game_catalog`, `resolve_exe_path` not defined.

- [ ] **Step 3: Implement the commands**

Add at the end of `src-tauri/src/commands.rs` (before the `#[cfg(test)] mod tests`), plus `use std::collections::HashMap;` and `use std::sync::LazyLock;` at the top import block if not already present:

```rust
// ---- Game Mode: game catalog + chip icons --------------------------------

#[derive(Debug, Clone, serde::Serialize)]
pub struct GameCatalogEntry {
    /// exe file name, e.g. "GTA5.exe" — same shape `game_mode_known_apps` stores.
    pub exe_name: String,
    /// Shortcut name / window title when known; secondary label in the picker.
    pub display_name: Option<String>,
}

/// Session cache of the installed-apps scan: built once on first catalog or
/// icon request, process-lifetime. A game installed mid-session appears in
/// the next app launch (accepted spec trade-off).
static INSTALLED_APPS: LazyLock<parking_lot::Mutex<Option<Vec<InstalledApp>>>> =
    LazyLock::new(|| parking_lot::Mutex::new(None));

/// Positive-only icon cache: canonical exe name -> base64 PNG (no data:
/// prefix). Failed lookups are cheap hash-miss retries, so they are not
/// cached.
static GAME_ICONS: LazyLock<parking_lot::Mutex<HashMap<String, String>>> =
    LazyLock::new(|| parking_lot::Mutex::new(HashMap::new()));

fn canonical_exe_key(name: &str) -> String {
    smoothscroll_core::settings::AppSettings::canonicalize_process_name(name)
}

/// Running-process entries come first (live-verified), installed entries fill
/// the rest; dedup is case-insensitive on the canonical exe name.
fn merge_game_catalog(
    installed: &[InstalledApp],
    running: &[smoothscroll_platform::traits::ProcessInfo],
) -> Vec<GameCatalogEntry> {
    let mut out: Vec<GameCatalogEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for p in running {
        let key = canonical_exe_key(&p.name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        let title = p.window_title.trim();
        out.push(GameCatalogEntry {
            exe_name: p.name.clone(),
            display_name: (!title.is_empty()).then(|| title.to_string()),
        });
    }
    for a in installed {
        let key = canonical_exe_key(&a.exe_name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        out.push(GameCatalogEntry {
            exe_name: a.exe_name.clone(),
            display_name: a.display_name.clone(),
        });
    }
    out
}

/// Resolves a known-game name to an on-disk exe: running processes first
/// (they carry `exe_path`), then the installed-apps scan.
fn resolve_exe_path(
    name: &str,
    installed: &[InstalledApp],
    running: &[smoothscroll_platform::traits::ProcessInfo],
) -> Option<std::path::PathBuf> {
    let key = canonical_exe_key(name);
    if key.is_empty() {
        return None;
    }
    running
        .iter()
        .find(|p| canonical_exe_key(&p.name) == key)
        .and_then(|p| p.exe_path.as_deref())
        .map(std::path::PathBuf::from)
        .or_else(|| {
            installed
                .iter()
                .find(|a| canonical_exe_key(&a.exe_name) == key)
                .map(|a| a.exe_path.clone())
        })
}

fn ensure_installed_apps() -> Vec<InstalledApp> {
    let mut guard = INSTALLED_APPS.lock();
    if guard.is_none() {
        *guard = Some(smoothscroll_platform::installed_apps::scan_installed_apps());
        tracing::info!(
            count = guard.as_ref().map_or(0, |v| v.len()),
            "installed-apps scan complete"
        );
    }
    guard.clone().unwrap_or_default()
}

/// Picker catalog: installed apps (session-cached scan) + currently running
/// visible apps (fresh per call), deduped.
#[tauri::command]
pub fn get_game_catalog(state: State<'_, Arc<AppState>>) -> Vec<GameCatalogEntry> {
    let running = state.processes.list_visible_processes();
    let installed = ensure_installed_apps();
    merge_game_catalog(&installed, &running)
}

/// Chip icons for known games. Keys of the response mirror the requested
/// names; misses resolve to `null` and the frontend falls back to its
/// generic icon. Successes are cached by canonical name.
#[tauri::command]
pub fn get_known_game_icons(
    state: State<'_, Arc<AppState>>,
    names: Vec<String>,
) -> HashMap<String, Option<String>> {
    let running = state.processes.list_visible_processes();
    let installed = ensure_installed_apps();
    let mut icons = GAME_ICONS.lock();
    let mut out: HashMap<String, Option<String>> = HashMap::new();
    for name in names {
        let key = canonical_exe_key(&name);
        if key.is_empty() {
            continue;
        }
        let icon = match icons.get(&key) {
            Some(b64) => Some(b64.clone()),
            None => resolve_exe_path(&name, &installed, &running)
                .and_then(|path| smoothscroll_platform::icon::extract_for_exe(&path))
                .inspect(|b64| {
                    icons.insert(key.clone(), b64.clone());
                }),
        };
        out.insert(name, icon);
    }
    out
}
```

In the same file's `use` block ensure `use smoothscroll_platform::installed_apps::InstalledApp;` (the statics and helpers reference the bare `InstalledApp`).

Register the commands in `src-tauri/src/lib.rs` inside `generate_handler![…]` directly after `commands::add_known_game,`:

```rust
            commands::get_game_catalog,
            commands::get_known_game_icons,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo test -p smoothscroll-app game_catalog_tests`
Expected: 4 tests PASS.

- [ ] **Step 5: Compile-gate the whole app crate**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo check -p smoothscroll-app`
Expected: clean (catches trait/derive drift, e.g. `ProcessInfo` Clone, missing imports).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: game picker catalog and chip icon commands"
```

---

### Task 4: GameModeSection rework — chips with icons + picker combobox

**Files:**
- Modify: `src/lib/tauri.ts` (types + two methods)
- Modify: `src/components/settings/GameModeSection.tsx` (rework)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/vi.json` (add keys, remove the orphaned `game_mode.placeholder`)
- Create: `src/components/settings/GameModeSection.test.tsx`

**Interfaces:**
- Consumes: `gameIconFor` (Task 1), `getGameCatalog`/`getKnownGameIcons` (Task 3).
- Produces: final user-facing UI; test file guards the behavior.

- [ ] **Step 1: Write the failing tests**

Create `src/components/settings/GameModeSection.test.tsx`:

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

beforeAll(() => {
  (globalThis as any).ResizeObserver =
    (globalThis as any).ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const h = vi.hoisted(() => ({ knownApps: ["GTA5.exe"] as string[] }));

const mockGetKnownGameIcons = vi.fn().mockResolvedValue({});
const mockGetGameCatalog = vi.fn();
const mockAddKnownGame = vi.fn().mockResolvedValue(null);
const mockRemoveKnownGame = vi.fn().mockResolvedValue(null);
const mockPatch = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@/lib/platform", () => ({ IS_LINUX: false }));

vi.mock("@/lib/gameIcons", () => ({
  gameIconFor: (name: string) =>
    name.toLowerCase().startsWith("gta5") ? "/bundled/gta5.png" : null,
}));

vi.mock("@/lib/tauri", () => ({
  tauri: {
    getGameModeStatus: vi.fn().mockResolvedValue(false),
    getKnownGameIcons: (names: string[]) => mockGetKnownGameIcons(names),
    getGameCatalog: () => mockGetGameCatalog(),
    addKnownGame: (name: string) => mockAddKnownGame(name),
    removeKnownGame: (name: string) => mockRemoveKnownGame(name),
  },
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: (selector: any) => selector({ patch: mockPatch }),
  useGameModeFields: () => ({
    game_mode_enabled: true,
    game_mode_known_apps: h.knownApps,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { GameModeSection } from "@/components/settings/GameModeSection";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetKnownGameIcons.mockResolvedValue({});
  mockAddKnownGame.mockResolvedValue(null);
  h.knownApps = ["GTA5.exe"];
});

afterEach(() => {
  h.knownApps = ["GTA5.exe"];
});

describe("GameModeSection", () => {
  it("renders chips with a bundled icon when available", () => {
    const { container } = render(<GameModeSection />);
    expect(screen.getByText("GTA5.exe")).toBeTruthy();
    expect(container.querySelector('img[src="/bundled/gta5.png"]')).toBeTruthy();
  });

  it("requests backend icons only for non-bundled games and renders them", async () => {
    h.knownApps = ["GTA5.exe", "Hades.exe"];
    mockGetKnownGameIcons.mockResolvedValue({ "Hades.exe": "aGFkZXM=" });
    const { container } = render(<GameModeSection />);
    await waitFor(() =>
      expect(mockGetKnownGameIcons).toHaveBeenCalledWith(["Hades.exe"]),
    );
    await waitFor(() =>
      expect(
        container.querySelector('img[src="data:image/png;base64,aGFkZXM="]'),
      ).toBeTruthy(),
    );
  });

  it("shows the fallback gamepad icon for a known game without any icon", async () => {
    h.knownApps = ["Hades.exe"];
    mockGetKnownGameIcons.mockResolvedValue({ "Hades.exe": null });
    render(<GameModeSection />);
    await waitFor(() => expect(screen.getByText("Hades.exe")).toBeTruthy());
    const chip = screen.getByText("Hades.exe").closest("span");
    expect(chip?.querySelector("img")).toBeNull();
    expect(chip?.querySelector("svg")).toBeTruthy();
  });

  it("opens the picker on click, lists catalog games, and hides known ones", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
      { exe_name: "GTA5.exe", display_name: "Grand Theft Auto V" },
    ]);
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    const list = await screen.findByTestId("game-picker-list");
    await within(list).findByText("Hades.exe");
    expect(within(list).queryByText("GTA5.exe")).toBeNull();
    expect(within(list).getByText("Grand Theft Auto V")).toBeTruthy();
  });

  it("filters by exe name and display name", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
      { exe_name: "Terraria.exe", display_name: null },
    ]);
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.click(input);
    const list = await screen.findByTestId("game-picker-list");
    await within(list).findByText("Hades.exe");

    fireEvent.change(input, { target: { value: "had" } });
    expect(within(list).queryByText("Terraria.exe")).toBeNull();
    expect(within(list).getByText("Hades.exe")).toBeTruthy();

    fireEvent.change(input, { target: { value: "terr" } });
    expect(within(list).queryByText("Hades.exe")).toBeNull();
    expect(within(list).getByText("Terraria.exe")).toBeTruthy();
  });

  it("adds a game on click through addKnownGame and patches the store", async () => {
    mockGetGameCatalog.mockResolvedValue([
      { exe_name: "Hades.exe", display_name: "Hades" },
    ]);
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    const list = await screen.findByTestId("game-picker-list");
    fireEvent.click(await within(list).findByText("Hades.exe"));
    await waitFor(() => expect(mockAddKnownGame).toHaveBeenCalledWith("Hades.exe"));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({
        game_mode_known_apps: ["GTA5.exe", "Hades.exe"],
      }),
    );
  });

  it("adds a manual exe name on Enter", async () => {
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.change(input, { target: { value: "mygame.exe" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockAddKnownGame).toHaveBeenCalledWith("mygame.exe"));
    expect(mockPatch).toHaveBeenCalledWith({
      game_mode_known_apps: ["GTA5.exe", "mygame.exe"],
    });
  });

  it("blocks case-insensitive duplicates", async () => {
    render(<GameModeSection />);
    const input = screen.getByPlaceholderText("game_mode.search_placeholder");
    fireEvent.change(input, { target: { value: "gta5.EXE" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockAddKnownGame).not.toHaveBeenCalled());
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("degrades to the empty state when the catalog fetch fails", async () => {
    mockGetGameCatalog.mockRejectedValue(new Error("scan failed"));
    render(<GameModeSection />);
    fireEvent.click(screen.getByPlaceholderText("game_mode.search_placeholder"));
    expect(await screen.findByText("game_mode.empty_state")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/settings/GameModeSection.test.tsx`
Expected: FAIL — `getKnownGameIcons` is not a function on the mocked tauri shape / placeholder key missing, i.e. the component doesn't implement the picker yet.

- [ ] **Step 3: Add the tauri.ts surface**

In `src/lib/tauri.ts`, next to the existing `ProcessInfo` interface add:

```ts
export interface GameCatalogEntry {
  exe_name: string;
  display_name: string | null;
}
```

In the `tauri` object's `// Game mode` block, after `getGameModeStatus` add:

```ts
  getGameCatalog: () => invoke<GameCatalogEntry[]>("get_game_catalog"),
  getKnownGameIcons: (names: string[]) =>
    invoke<Record<string, string | null>>("get_known_game_icons", { names }),
```

- [ ] **Step 4: Rework the component**

Replace the body of `src/components/settings/GameModeSection.tsx`:

```tsx
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useGameModeFields } from "@/stores/settingsStore";
import { tauri, type GameCatalogEntry } from "@/lib/tauri";
import { IS_LINUX } from "@/lib/platform";
import { gameIconFor } from "@/lib/gameIcons";
import { Gamepad2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

/** 16x16 chip icon: bundled asset -> backend-extracted -> generic fallback. */
function GameIcon({ name, iconUrl }: { name: string; iconUrl?: string | null }) {
  const src = gameIconFor(name) ?? iconUrl ?? null;
  if (!src) {
    return <Gamepad2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <img src={src} alt="" className="h-4 w-4 shrink-0 rounded-sm" />;
}

function GameModeSectionInner() {
  const { t } = useTranslation();
  const fields = useGameModeFields();
  const patch = useSettingsStore((s) => s.patch);
  const [active, setActive] = useState(false);
  const [newGame, setNewGame] = useState("");
  const [backendIcons, setBackendIcons] = useState<Record<string, string | null>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState<GameCatalogEntry[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    tauri.getGameModeStatus().then(setActive);
    const unlistenPromise = listen<boolean>("game-mode-changed", (e) => setActive(e.payload));
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  // Icons for known games not covered by the bundled map. Backend caches by
  // name, so re-fetching after each add/remove is cheap.
  useEffect(() => {
    if (!fields) return;
    const need = fields.game_mode_known_apps.filter((n) => !gameIconFor(n));
    if (need.length === 0) return;
    let cancelled = false;
    tauri
      .getKnownGameIcons(need)
      .then((map) => {
        if (!cancelled) setBackendIcons((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fields?.game_mode_known_apps]);

  const knownApps = fields?.game_mode_known_apps ?? [];
  const knownLower = useMemo(
    () => new Set(knownApps.map((n) => n.toLowerCase())),
    [knownApps],
  );
  const filteredCatalog = useMemo(() => {
    const f = newGame.trim().toLowerCase();
    return (catalog ?? []).filter((c) => {
      if (knownLower.has(c.exe_name.toLowerCase())) return false;
      if (!f) return true;
      return (
        c.exe_name.toLowerCase().includes(f) ||
        (c.display_name ?? "").toLowerCase().includes(f)
      );
    });
  }, [catalog, newGame, knownLower]);

  if (!fields) return null;

  const openPicker = () => {
    setPickerOpen(true);
    if (catalog || catalogLoading) return;
    setCatalogLoading(true);
    tauri
      .getGameCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  };

  const addGame = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (fields.game_mode_known_apps.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
      setNewGame("");
      return;
    }
    await tauri.addKnownGame(trimmed);
    patch({ game_mode_known_apps: [...fields.game_mode_known_apps, trimmed] });
    setNewGame("");
    setPickerOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.game_mode")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t("game_mode.auto_disable")}</Label>
          <Switch
            checked={fields.game_mode_enabled}
            onCheckedChange={(v) => patch({ game_mode_enabled: v })}
          />
        </div>
        <div className={`rounded p-2 text-sm ${active ? "bg-orange-100 dark:bg-orange-950" : "bg-muted"}`}>
          {t("game_mode.status_label")}:{" "}
          {active ? t("game_mode.status_active") : t("game_mode.status_inactive")}
        </div>
        <div className="space-y-2">
          <Label>{t("game_mode.known_games")}</Label>
          <div className="flex flex-wrap gap-1">
            {fields.game_mode_known_apps.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-0.5 text-xs">
                <GameIcon name={g} iconUrl={backendIcons[g]} />
                {g}
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await tauri.removeKnownGame(g);
                    patch({ game_mode_known_apps: fields.game_mode_known_apps.filter((x) => x !== g) });
                  }}
                >×</button>
              </span>
            ))}
          </div>
          <Popover open={pickerOpen} onOpenChange={(o) => (o ? openPicker() : setPickerOpen(false))}>
            <PopoverTrigger asChild>
              <Input
                placeholder={IS_LINUX ? 'steam' : t("game_mode.search_placeholder")}
                value={newGame}
                onChange={(e) => setNewGame(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addGame(newGame);
                  }
                }}
              />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <ScrollArea className="h-64">
                <div data-testid="game-picker-list">
                  {catalogLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("game_mode.loading")}
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {t("game_mode.empty_state")}
                    </div>
                  ) : (
                    filteredCatalog.map((c) => (
                      <button
                        key={c.exe_name}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                        onClick={() => void addGame(c.exe_name)}
                      >
                        <GameIcon name={c.exe_name} iconUrl={backendIcons[c.exe_name]} />
                        <span className="font-medium">{c.exe_name}</span>
                        {c.display_name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {c.display_name}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}

export const GameModeSection = memo(GameModeSectionInner);
```

Note: the previous free-text + `Add` button is gone by design; the `Input` keeps the `IS_LINUX` placeholder branch and the Enter-to-add path. The old `Button` import is removed (no longer used — this is the orphan created by this change).

- [ ] **Step 5: Update the en + vi locales**

`src/i18n/locales/en.json` — in the `game_mode` block remove `"placeholder": "game.exe"` (orphaned by this change) and add:

```json
    "search_placeholder": "Search games or type a .exe name…",
    "loading": "Scanning apps…",
    "empty_state": "No match? Type the .exe name and press Enter."
```

`src/i18n/locales/vi.json` — same block, same removal, add:

```json
    "search_placeholder": "Tìm game hoặc nhập tên .exe…",
    "loading": "Đang quét ứng dụng…",
    "empty_state": "Không thấy? Nhập tên .exe rồi nhấn Enter."
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/settings/GameModeSection.test.tsx`
Expected: 9 tests PASS (Radix Popover renders content through a portal in jsdom; the `data-testid` wrapper keeps queries scoped).

- [ ] **Step 7: Typecheck and lint the touched files**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tauri.ts src/components/settings/GameModeSection.tsx src/components/settings/GameModeSection.test.tsx src/i18n/locales/en.json src/i18n/locales/vi.json
git commit -m "feat: game picker combobox and chip icons in game mode"
```

---

### Task 5: Remaining 12 locales

**Files:**
- Modify: `src/i18n/locales/ja.json`, `ko.json`, `zh.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `pt-BR.json`, `ru.json`, `tr.json`, `id.json`, `hi.json`

**Interfaces:**
- Consumes: nothing. Produces: complete i18n coverage for the three new keys across all 14 locales.

- [ ] **Step 1: Add the keys, remove the orphan**

In each file's `game_mode` block: remove `"placeholder": …` and add the three keys with these exact values:

| locale | search_placeholder | loading | empty_state |
| --- | --- | --- | --- |
| ja | `ゲームを検索または .exe 名を入力…` | `アプリをスキャン中…` | `見つからない？.exe 名を入力して Enter を押してください。` |
| ko | `게임 검색 또는 .exe 이름 입력…` | `앱 검색 중…` | `결과가 없나요? .exe 이름을 입력하고 Enter를 누르세요.` |
| zh | `搜索游戏或输入 .exe 名称…` | `正在扫描应用…` | `没有找到？输入 .exe 名称后按 Enter。` |
| de | `Spiele suchen oder .exe-Namen eingeben…` | `Apps werden gescannt…` | `Nicht gefunden? Gib den .exe-Namen ein und drücke Enter.` |
| es | `Buscar juegos o escribir un nombre .exe…` | `Escaneando aplicaciones…` | `¿Sin resultados? Escribe el nombre .exe y pulsa Enter.` |
| fr | `Rechercher des jeux ou saisir un nom .exe…` | `Analyse des applications…` | `Aucun résultat ? Saisissez le nom .exe et appuyez sur Entrée.` |
| it | `Cerca giochi o digita un nome .exe…` | `Scansione app in corso…` | `Nessun risultato? Digita il nome .exe e premi Invio.` |
| pt-BR | `Pesquisar jogos ou digitar um nome .exe…` | `Escaneando aplicativos…` | `Sem resultados? Digite o nome .exe e pressione Enter.` |
| ru | `Поиск игр или введите имя .exe…` | `Сканирование приложений…` | `Ничего не найдено? Введите имя .exe и нажмите Enter.` |
| tr | `Oyun ara veya .exe adı yaz…` | `Uygulamalar taranıyor…` | `Sonuç yok mu? .exe adını yazıp Enter'a basın.` |
| id | `Cari game atau ketik nama .exe…` | `Memindai aplikasi…` | `Tidak ketemu? Ketik nama .exe lalu tekan Enter.` |
| hi | `गेम खोजें या .exe नाम टाइप करें…` | `ऐप्स स्कैन हो रहे हैं…` | `कोई मैच नहीं? .exe नाम टाइप करें और Enter दबाएँ।` |

- [ ] **Step 2: Verify no locale JSON broke**

Run: `node -e "const fs=require('fs');for(const f of fs.readdirSync('src/i18n/locales')){const j=JSON.parse(fs.readFileSync('src/i18n/locales/'+f,'utf8'));if(!j.game_mode||!j.game_mode.search_placeholder)throw new Error(f)}console.log('all locales ok')"`
Expected: `all locales ok`

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales
git commit -m "feat: translate game picker strings"
```

---

### Task 6: Full verification + UAT handoff

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full frontend test suite (scoped to src/)**

Run: `npx vitest run src`
Expected: all PASS — including the pre-existing suites (Settings.test.tsx, settingsStore.test.tsx must not regress).

- [ ] **Step 2: Full Rust test run**

Run: `CARGO_TARGET_DIR=D:/SmoothScroll/target cargo test --workspace`
Expected: all PASS, including the new `installed_apps` and `game_catalog_tests` modules.

- [ ] **Step 3: Production-type build gate**

Run: `npx tsc --noEmit && npx vite build`
Expected: clean — this is the gate that catches a bundled icon file that was deleted/renamed after `gameIcons.ts` referenced it.

- [ ] **Step 4: Hand off to UAT**

Report to the user for manual testing on a built app (established workflow: the user tests the UI themselves):
1. Chips: default games show bundled icons; a user-added installed game shows its extracted icon; a not-installed manual entry shows the gamepad fallback.
2. Picker: click input → dropdown lists running + installed apps; filter; click adds; Enter adds manual text; duplicates blocked; catalog failure degrades to the empty state.
3. Language switch: new strings render in the active locale.

Any icon the user dislikes is replaced by dropping a new PNG over `src/assets/games/<name>.png` — no code change.

---

## Plan self-review (recorded)

- **Spec coverage:** chip icon 3-level fallback (Tasks 1+4), picker sources + session cache (Tasks 2+3), click/Enter UX + hidden known games + empty state + failure degrade (Task 4), i18n ×14 (Tasks 4+5), assets sourcing + maintenance rule (Task 1), out-of-scope items untouched. ✓
- **Placeholder scan:** the only "manual fetch" is an explicit decision procedure with a defined fallback (drop the entry → generic icon), not an unresolved TBD. ✓
- **Type consistency:** `gameIconFor(name)` (Task 1) = Task 4 usage; `GameCatalogEntry{exe_name, display_name}` (Task 3) = `tauri.ts` + component (Task 4); `scan_installed_apps/InstalledApp` (Task 2) = Task 3 statics. Response of `get_known_game_icons` keyed by raw requested name — matches the component's `backendIcons[g]` lookup. Review caught and fixed: `ProcessInfo.exe_path` is `Option<String>` (not `PathBuf`) — `resolve_exe_path` maps it to an owned `PathBuf`; Task 2 test module imports `PathBuf` explicitly. ✓
