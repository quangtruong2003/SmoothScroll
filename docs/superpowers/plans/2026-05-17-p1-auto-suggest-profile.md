# P1 — Auto-Suggest Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi user thêm app vào per-app profiles, gợi ý preset phù hợp dựa trên loại app (Browser, IDE, Office, etc.) để giảm friction onboarding.

**Architecture:** Static map process_name → AppCategory trong core crate. New IPC command `suggest_profile_for_app` returns suggestion. UI hiển thị "Use suggestion / Pick manually" card trong AppProfileAssignDialog.

**Tech Stack:** Rust (smoothscroll_core), Tauri 2 IPC, React + TypeScript, zustand store.

**Spec:** [docs/superpowers/specs/2026-05-17-p1-auto-suggest-profile-design.md](../specs/2026-05-17-p1-auto-suggest-profile-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `crates/core/src/app_categories.rs` | CREATE | AppCategory enum, classify_app, preset_for_category |
| `crates/core/src/lib.rs` | EDIT | Add `pub mod app_categories;` |
| `crates/core/tests/app_categories_tests.rs` | CREATE | Unit tests |
| `src-tauri/src/commands.rs` | EDIT | Add `suggest_profile_for_app` command |
| `src-tauri/src/lib.rs` | EDIT | Register new command |
| `src/lib/tauri.ts` | EDIT | TS wrapper + types |
| `src/components/settings/AppProfileAssignDialog.tsx` | EDIT | Suggestion card UI |
| `src/i18n/en.json` + `vi.json` + `zh.json` | EDIT | i18n keys |

---

## Task 1: Create AppCategory enum + classify_app

**Files:**
- Create: `crates/core/src/app_categories.rs`
- Modify: `crates/core/src/lib.rs`
- Test: `crates/core/tests/app_categories_tests.rs`

- [ ] **Step 1: Write failing test**

Create `crates/core/tests/app_categories_tests.rs`:

```rust
use smoothscroll_core::app_categories::{classify_app, AppCategory};

#[test]
fn classifies_chrome_as_browser() {
    assert_eq!(classify_app("chrome.exe"), AppCategory::Browser);
}

#[test]
fn classification_is_case_insensitive() {
    assert_eq!(classify_app("ChRoMe.ExE"), AppCategory::Browser);
    assert_eq!(classify_app("CODE.EXE"), AppCategory::Ide);
}

#[test]
fn unknown_apps_return_unknown() {
    assert_eq!(classify_app("totally_random_app.exe"), AppCategory::Unknown);
}

#[test]
fn empty_input_returns_unknown() {
    assert_eq!(classify_app(""), AppCategory::Unknown);
}

#[test]
fn classifies_office_apps() {
    assert_eq!(classify_app("WINWORD.EXE"), AppCategory::Office);
    assert_eq!(classify_app("EXCEL.EXE"), AppCategory::Office);
}

#[test]
fn classifies_terminal_apps() {
    assert_eq!(classify_app("WindowsTerminal.exe"), AppCategory::Terminal);
    assert_eq!(classify_app("alacritty.exe"), AppCategory::Terminal);
}

#[test]
fn classifies_known_games() {
    assert_eq!(classify_app("LeagueOfLegends.exe"), AppCategory::Game);
    assert_eq!(classify_app("VALORANT.exe"), AppCategory::Game);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cargo test -p smoothscroll_core --test app_categories_tests
```

Expected: FAIL — compilation error "unresolved import `smoothscroll_core::app_categories`".

- [ ] **Step 3: Create app_categories.rs**

Create `crates/core/src/app_categories.rs`:

```rust
//! Application categorization for profile auto-suggestion.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppCategory {
    Browser, Ide, Office, Pdf, Terminal, Chat, Media, Game, Unknown,
}

impl AppCategory {
    pub fn label(self) -> &'static str {
        match self {
            Self::Browser => "Browser",
            Self::Ide => "IDE",
            Self::Office => "Office",
            Self::Pdf => "PDF Reader",
            Self::Terminal => "Terminal",
            Self::Chat => "Chat",
            Self::Media => "Media Player",
            Self::Game => "Game",
            Self::Unknown => "Unknown",
        }
    }
}

const BROWSERS: &[&str] = &[
    "chrome.exe", "firefox.exe", "msedge.exe", "brave.exe",
    "vivaldi.exe", "opera.exe", "arc.exe", "thorium.exe",
];
const IDES: &[&str] = &[
    "code.exe", "code - insiders.exe", "cursor.exe",
    "idea64.exe", "idea.exe", "pycharm64.exe", "pycharm.exe",
    "webstorm64.exe", "webstorm.exe", "rider64.exe", "rider.exe",
    "clion64.exe", "clion.exe", "goland64.exe", "goland.exe",
    "rubymine64.exe", "rubymine.exe", "phpstorm64.exe", "phpstorm.exe",
    "sublime_text.exe", "atom.exe", "devenv.exe",
];
const OFFICE: &[&str] = &[
    "winword.exe", "excel.exe", "powerpnt.exe",
    "onenote.exe", "outlook.exe", "msaccess.exe",
];
const PDF: &[&str] = &[
    "acrobat.exe", "acrord32.exe", "sumatrapdf.exe",
    "foxitreader.exe", "foxitpdfreader.exe",
];
const TERMINAL: &[&str] = &[
    "windowsterminal.exe", "wt.exe", "wezterm-gui.exe",
    "alacritty.exe", "conemu64.exe", "conemu.exe",
    "cmder.exe", "cmd.exe", "powershell.exe", "pwsh.exe",
];
const CHAT: &[&str] = &[
    "slack.exe", "discord.exe", "teams.exe", "ms-teams.exe",
    "telegram.exe", "whatsapp.exe", "skype.exe", "signal.exe",
];
const MEDIA: &[&str] = &[
    "vlc.exe", "spotify.exe", "musicbee.exe",
    "foobar2000.exe", "potplayer.exe", "potplayermini64.exe",
];
const GAMES: &[&str] = &[
    "leagueoflegends.exe", "valorant.exe", "csgo.exe", "cs2.exe",
    "dota2.exe", "apexlegends.exe", "rainbowsix.exe",
    "fortniteclient-win64-shipping.exe", "pubg.exe",
    "gta5.exe", "rdr2.exe", "eldenring.exe", "cyberpunk2077.exe",
    "witcher3.exe", "minecraftlauncher.exe", "javaw.exe",
    "rocketleague.exe", "overwatch.exe", "overwatch2.exe",
    "wow.exe", "ffxiv_dx11.exe", "warframe.exe",
    "factorio.exe", "terraria.exe", "stardewvalley.exe",
];

pub fn classify_app(name: &str) -> AppCategory {
    if name.is_empty() { return AppCategory::Unknown; }
    let lower = name.to_ascii_lowercase();
    if BROWSERS.contains(&lower.as_str()) { return AppCategory::Browser; }
    if IDES.contains(&lower.as_str()) { return AppCategory::Ide; }
    if OFFICE.contains(&lower.as_str()) { return AppCategory::Office; }
    if PDF.contains(&lower.as_str()) { return AppCategory::Pdf; }
    if TERMINAL.contains(&lower.as_str()) { return AppCategory::Terminal; }
    if CHAT.contains(&lower.as_str()) { return AppCategory::Chat; }
    if MEDIA.contains(&lower.as_str()) { return AppCategory::Media; }
    if GAMES.contains(&lower.as_str()) { return AppCategory::Game; }
    AppCategory::Unknown
}
```

Modify `crates/core/src/lib.rs` — add line:

```rust
pub mod app_categories;
```

- [ ] **Step 4: Run test, verify pass**

```bash
cargo test -p smoothscroll_core --test app_categories_tests
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/app_categories.rs crates/core/src/lib.rs crates/core/tests/app_categories_tests.rs
git commit -m "feat(core): add AppCategory enum + classify_app"
```

---

## Task 2: Add preset_for_category

**Files:**
- Modify: `crates/core/src/app_categories.rs`
- Test: `crates/core/tests/app_categories_tests.rs`

- [ ] **Step 1: Write failing test**

Append to `crates/core/tests/app_categories_tests.rs`:

```rust
use smoothscroll_core::app_categories::{preset_for_category, SuggestedPreset};

#[test]
fn ide_preset_is_snappy() {
    let preset = preset_for_category(AppCategory::Ide);
    match preset {
        SuggestedPreset::Profile(p) => {
            assert_eq!(p.step_size_px, 100);
            assert_eq!(p.animation_time_ms, 250);
            assert_eq!(p.acceleration_max, 10);
        }
        _ => panic!("expected Profile"),
    }
}

#[test]
fn game_preset_is_disabled() {
    assert!(matches!(preset_for_category(AppCategory::Game), SuggestedPreset::Disabled));
}

#[test]
fn pdf_preset_is_mac_like() {
    if let SuggestedPreset::Profile(p) = preset_for_category(AppCategory::Pdf) {
        assert_eq!(p.step_size_px, 140);
        assert_eq!(p.animation_time_ms, 500);
    } else { panic!("expected Profile"); }
}

#[test]
fn unknown_preset_matches_global_default() {
    if let SuggestedPreset::Profile(p) = preset_for_category(AppCategory::Unknown) {
        assert_eq!(p.step_size_px, 120);
        assert_eq!(p.animation_time_ms, 360);
    } else { panic!("expected Profile"); }
}
```

- [ ] **Step 2: Run test, verify failure**

```bash
cargo test -p smoothscroll_core --test app_categories_tests
```

Expected: FAIL — `cannot find function preset_for_category`.

- [ ] **Step 3: Add preset_for_category**

Append to `crates/core/src/app_categories.rs`:

```rust
use crate::settings::ScrollProfile;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum SuggestedPreset {
    Profile(ScrollProfile),
    Disabled,
}

pub fn preset_for_category(cat: AppCategory) -> SuggestedPreset {
    let mut p = ScrollProfile::new("", "");
    match cat {
        AppCategory::Browser => {
            p.step_size_px = 120; p.animation_time_ms = 360;
            p.acceleration_delta_ms = 70; p.acceleration_max = 7;
        }
        AppCategory::Ide => {
            p.step_size_px = 100; p.animation_time_ms = 250;
            p.acceleration_delta_ms = 40; p.acceleration_max = 10;
        }
        AppCategory::Office => {
            p.step_size_px = 100; p.animation_time_ms = 400;
            p.acceleration_delta_ms = 80; p.acceleration_max = 6;
        }
        AppCategory::Pdf => {
            p.step_size_px = 140; p.animation_time_ms = 500;
            p.acceleration_delta_ms = 80; p.acceleration_max = 6;
        }
        AppCategory::Terminal => {
            p.step_size_px = 80; p.animation_time_ms = 200;
            p.acceleration_delta_ms = 30; p.acceleration_max = 12;
        }
        AppCategory::Chat => {
            p.step_size_px = 120; p.animation_time_ms = 300;
            p.acceleration_delta_ms = 60; p.acceleration_max = 8;
        }
        AppCategory::Media => {
            p.step_size_px = 100; p.animation_time_ms = 350;
            p.acceleration_delta_ms = 70; p.acceleration_max = 7;
        }
        AppCategory::Game => return SuggestedPreset::Disabled,
        AppCategory::Unknown => {
            p.step_size_px = 120; p.animation_time_ms = 360;
            p.acceleration_delta_ms = 70; p.acceleration_max = 7;
        }
    }
    SuggestedPreset::Profile(p)
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
cargo test -p smoothscroll_core --test app_categories_tests
```

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/app_categories.rs crates/core/tests/app_categories_tests.rs
git commit -m "feat(core): add preset_for_category"
```

---

## Task 3: Add IPC command suggest_profile_for_app

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add command**

Append to `src-tauri/src/commands.rs`:

```rust
use smoothscroll_core::app_categories::{
    classify_app, preset_for_category, AppCategory, SuggestedPreset,
};

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProfileSuggestion {
    pub category: AppCategory,
    pub category_label: String,
    pub preset: SuggestedPreset,
}

#[tauri::command]
pub fn suggest_profile_for_app(name: String) -> ProfileSuggestion {
    let category = classify_app(&name);
    let preset = preset_for_category(category);
    ProfileSuggestion {
        category,
        category_label: category.label().to_string(),
        preset,
    }
}
```

- [ ] **Step 2: Register command**

Modify `src-tauri/src/lib.rs` — add `commands::suggest_profile_for_app` to `tauri::generate_handler![...]`.

- [ ] **Step 3: Verify build**

```bash
cargo check -p smoothscroll-app
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): add suggest_profile_for_app IPC"
```

---

## Task 4: TypeScript types + wrapper

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add types and method**

Append to `src/lib/tauri.ts`:

```typescript
export type AppCategory =
  | "Browser" | "Ide" | "Office" | "Pdf"
  | "Terminal" | "Chat" | "Media" | "Game" | "Unknown";

export type SuggestedPreset =
  | { kind: "Profile"; data: ScrollProfile }
  | { kind: "Disabled" };

export interface ProfileSuggestion {
  category: AppCategory;
  category_label: string;
  preset: SuggestedPreset;
}
```

Inside `tauri` object:

```typescript
async suggestProfileForApp(name: string): Promise<ProfileSuggestion> {
  return invoke<ProfileSuggestion>("suggest_profile_for_app", { name });
},
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat(ui): add suggestProfileForApp wrapper"
```

---

## Task 5: Suggestion card UI

**Files:**
- Modify: `src/components/settings/AppProfileAssignDialog.tsx`

- [ ] **Step 1: Add state hook**

In the component, add:

```typescript
import { useEffect, useState } from "react";
import type { ProfileSuggestion } from "@/lib/tauri";
import { tauri } from "@/lib/tauri";

const [suggestion, setSuggestion] = useState<ProfileSuggestion | null>(null);
const [showSuggestion, setShowSuggestion] = useState(true);

useEffect(() => {
  if (!selectedApp) { setSuggestion(null); return; }
  tauri.suggestProfileForApp(selectedApp).then(setSuggestion);
}, [selectedApp]);
```

(`selectedApp` = the existing variable holding the picked process name.)

- [ ] **Step 2: Render card above dropdown**

Insert above profile dropdown JSX:

```tsx
{showSuggestion && suggestion && suggestion.category !== "Unknown" && (
  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
    <div>
      💡 <strong>Suggested for {suggestion.category_label}:</strong>{" "}
      {suggestion.preset.kind === "Disabled"
        ? "Disable smoothing"
        : `Custom preset (${suggestion.preset.data.step_size_px}px, ${suggestion.preset.data.animation_time_ms}ms)`}
    </div>
    <div className="mt-2 flex gap-2">
      <Button size="sm" onClick={() => handleUseSuggestion(suggestion)}>Use suggestion</Button>
      <Button size="sm" variant="outline" onClick={() => setShowSuggestion(false)}>Pick manually</Button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Implement handler**

Add inside component:

```typescript
const { createProfile, assignAppProfile, updateProfile } = useSettingsStore();

async function handleUseSuggestion(s: ProfileSuggestion) {
  if (!selectedApp) return;
  if (s.preset.kind === "Disabled") {
    await assignAppProfile(selectedApp, "__disabled__");
    onClose();
    return;
  }
  const baseName = `${s.category_label} (auto)`;
  const newProfile = await createProfile(baseName);
  const merged = { ...newProfile, ...s.preset.data, id: newProfile.id, name: baseName };
  await updateProfile(merged);
  await assignAppProfile(selectedApp, newProfile.id);
  onClose();
}
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open Settings → Profiles → Assign app → pick `chrome.exe` → expect Browser suggestion card.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/AppProfileAssignDialog.tsx
git commit -m "feat(ui): show profile suggestion card in assign dialog"
```

---

## Task 6: i18n keys

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/vi.json`, `src/i18n/zh.json`

- [ ] **Step 1: Add keys**

Under existing `profiles` section in each locale, add:

`en.json`:
```json
"suggest": {
  "title": "Suggested for {{category}}",
  "use": "Use suggestion",
  "manual": "Pick manually"
}
```

`vi.json`:
```json
"suggest": {
  "title": "Gợi ý cho {{category}}",
  "use": "Dùng gợi ý",
  "manual": "Chọn thủ công"
}
```

`zh.json`:
```json
"suggest": {
  "title": "{{category}} 推荐",
  "use": "使用建议",
  "manual": "手动选择"
}
```

- [ ] **Step 2: Wire t() into component**

Replace hardcoded English in suggestion card with `{t("profiles.suggest.title", { category: suggestion.category_label })}`, etc.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/*.json src/components/settings/AppProfileAssignDialog.tsx
git commit -m "feat(i18n): profile suggestion strings"
```

---

## Task 7: Final smoke + build

- [ ] **Step 1: Full Tauri build**

```bash
cargo tauri build
```

Expected: SUCCESS.

- [ ] **Step 2: Manual smoke checklist**

Install + run:
- [ ] `chrome.exe` → "Suggested for Browser" card.
- [ ] "Use suggestion" → new "Browser (auto)" profile assigned.
- [ ] `Code.exe` → "Suggested for IDE".
- [ ] Known game → "Disable smoothing" suggestion.
- [ ] `randomapp.exe` → no card (Unknown).
- [ ] "Pick manually" → card hides.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: P1 final fixes" --allow-empty
```

---

## Self-Review Checklist

- [x] Spec section 3.1 enum → Task 1
- [x] Spec section 3.2 process map → Task 1 constants
- [x] Spec section 3.3 preset table → Task 2
- [x] Spec section 3.4 IPC payload → Task 3
- [x] Spec section 3.5 UI → Tasks 5 + 6
- [x] Spec section 7 testing → Tasks 1, 2 + Task 7 manual
