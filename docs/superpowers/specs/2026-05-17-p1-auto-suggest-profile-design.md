# SmoothScroll P1 — Auto-Suggest Profile Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe build first; macOS later
**Effort:** S (1-3 days)

## 1. Goal

Khi user thêm một app vào danh sách per-app profiles (qua `AppProfileAssignDialog`), gợi ý preset phù hợp dựa trên loại app. Giảm friction onboarding — user không phải tự nghĩ "Browser nên dùng setting nào".

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React UI (src/)                                         │
│  - components/settings/AppProfileAssignDialog.tsx [EDIT] │
│      hiển thị badge "Suggested: Default" cạnh app name   │
│      auto-select suggested profile in dropdown           │
│  - lib/profile-suggest.ts                        [NEW]   │
│      thin wrapper qua IPC suggest_profile_for_app        │
├──────────────────────────────────────────────────────────┤
│  Tauri commands (src-tauri/src/commands.rs)              │
│  - suggest_profile_for_app(name) → ProfileSuggestion     │
│      [NEW]                                                │
├──────────────────────────────────────────────────────────┤
│  Core (crates/core/src/)                                 │
│  - app_categories.rs                            [NEW]    │
│      static map: process_name → AppCategory              │
│      classify_app(name) → AppCategory                    │
│      preset_for_category(cat) → ScrollProfile defaults   │
│  - lib.rs: pub mod app_categories                [EDIT]  │
└──────────────────────────────────────────────────────────┘
```

## 3. Component details

### 3.1 AppCategory enum

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppCategory {
    Browser,    // Chrome, Firefox, Edge, Brave, Vivaldi, Arc
    Ide,        // VSCode, IntelliJ, PyCharm, Sublime, Atom
    Office,     // Word, Excel, PowerPoint, OneNote
    Pdf,        // Acrobat, SumatraPDF, Foxit
    Terminal,   // WindowsTerminal, ConEmu, Cmder, Alacritty, wezterm
    Chat,       // Slack, Discord, Teams, Telegram, WhatsApp
    Media,      // VLC, Photos, Spotify
    Game,       // Steam, EpicGames... (informational only — không gợi ý smoothing)
    Unknown,
}
```

### 3.2 Process name → category map

Static table tại `app_categories.rs` (~80 entries). Match case-insensitive, exact filename match (không partial). Examples:

| Process | Category |
|---|---|
| `chrome.exe`, `firefox.exe`, `msedge.exe`, `brave.exe` | Browser |
| `Code.exe`, `idea64.exe`, `pycharm64.exe`, `sublime_text.exe` | Ide |
| `WINWORD.EXE`, `EXCEL.EXE`, `POWERPNT.EXE` | Office |
| `Acrobat.exe`, `SumatraPDF.exe`, `FoxitReader.exe` | Pdf |
| `WindowsTerminal.exe`, `wezterm-gui.exe`, `alacritty.exe` | Terminal |
| `slack.exe`, `Discord.exe`, `Teams.exe` | Chat |

### 3.3 Suggested preset per category

| Category | step | anim_time | accel_delta | accel_max | Notes |
|---|---|---|---|---|---|
| Browser | 120 | 360 | 70 | 7 | Default — already tuned for browsing |
| Ide | 100 | 250 | 40 | 10 | Snappier — code navigation |
| Office | 100 | 400 | 80 | 6 | Smooth + slow accel for spreadsheets |
| Pdf | 140 | 500 | 80 | 6 | Mac-like for reading |
| Terminal | 80 | 200 | 30 | 12 | Quick, near-instant |
| Chat | 120 | 300 | 60 | 8 | Default-ish |
| Media | 100 | 350 | 70 | 7 | Default |
| Game | — | — | — | — | Suggest "Disabled" (DISABLED_PROFILE_ID) |
| Unknown | 120 | 360 | 70 | 7 | Same as global default |

### 3.4 IPC payload

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ProfileSuggestion {
    pub category: AppCategory,
    pub category_label: String,  // "Browser", "IDE", etc.
    pub preset: SuggestedPreset,
}

#[derive(Debug, Clone, Serialize)]
pub enum SuggestedPreset {
    Profile(ScrollProfile),     // proposed settings
    Disabled,                    // recommend exclusion (for Game)
}
```

### 3.5 UI integration

`AppProfileAssignDialog.tsx`:
- Khi user pick app từ list → call `suggest_profile_for_app(processName)`.
- Above the profile dropdown: hiển thị card nhỏ
  ```
  💡 Suggested for IDE: Snappy preset
  [Use suggestion]  [Pick manually]
  ```
- Click "Use suggestion" → tạo profile mới với preset, gán cho app, đóng dialog.
- Click "Pick manually" → ẩn card, dropdown hiện ra như trước.

## 4. Settings JSON schema

Không thay đổi schema. Mọi gợi ý chỉ là client-side recommendation; profile mới tạo qua existing `create_profile` + `update_profile` flow.

## 5. New IPC commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `suggest_profile_for_app` | `name: String` | `Option<ProfileSuggestion>` | Classify + return preset suggestion |

## 6. Migration / risk

- **No breaking changes:** purely additive feature.
- **Map maintenance:** category map có thể out of date. Mitigation: `Unknown` category fallback → no harm done.
- **Localization:** `category_label` returned untranslated; UI translates qua i18n key `category.browser`, `category.ide`, etc.
- **False positives:** vd `code.exe` cũng có thể là tool khác. Acceptable — user có thể "Pick manually".

## 7. Testing

| Layer | Test | Tool |
|---|---|---|
| Core | `classify_app("chrome.exe") == Browser` | `#[test]` |
| Core | `classify_app("ChRoMe.ExE") == Browser` (case insensitive) | `#[test]` |
| Core | `classify_app("unknown.exe") == Unknown` | `#[test]` |
| Core | `preset_for_category(Ide).step_size_px == 100` | `#[test]` |
| Manual | Add Code.exe → see "Suggested IDE" card → click Use → settings applied | Run dev build |

## 8. Out of scope

- Custom user mappings (user-defined process → category)
- Online category database update
- macOS app bundle ID classification
- Auto-detect category by window class instead of just process name

## 9. Build verification

```bash
cargo test -p smoothscroll_core
cargo tauri build
```

Smoke checklist:
- [ ] Dialog hiển thị suggestion card khi pick known browser
- [ ] "Use suggestion" tạo profile + gán app
- [ ] Unknown app vẫn hoạt động bình thường (no card hiển thị, hoặc generic "Default")
- [ ] Game category gợi ý "Disable for this app"
