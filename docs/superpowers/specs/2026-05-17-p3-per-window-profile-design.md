# SmoothScroll P3 — Per-Window Profile Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe build (window class is Win32-specific)
**Effort:** M (1 week)

## 1. Goal

Mở rộng per-app profile sang per-window: cho phép user gán profile khác nhau cho **các cửa sổ con khác nhau trong cùng 1 process**. Ví dụ:

- VSCode editor (`Code.exe` + class `Chrome_WidgetWin_1`) → "Snappy" preset
- VSCode integrated terminal (`Code.exe` + class `xterm` injected) → "Default"
- Excel main grid (`EXCEL.EXE` + class `EXCEL7`) → "Office" preset
- Excel formula bar / dialog → exclude

Tận dụng pattern `app_profiles: HashMap` đã có; mở rộng key từ `String` (process_name) → composite matcher.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Core (crates/core/src/settings.rs)                      │
│  - struct WindowMatcher {                                 │
│      process_name: String,                                │
│      window_class: Option<String>,  // None = any class  │
│      window_title_contains: Option<String>,              │
│    }                                            [NEW]    │
│  - app_profiles: HashMap<String, String>     [DEPRECATE] │
│  - window_profiles: Vec<WindowProfileRule>     [NEW]     │
│  - struct WindowProfileRule {                            │
│      matcher: WindowMatcher,                             │
│      profile_id: String,                                 │
│      priority: u32,  // higher wins on tie               │
│    }                                                      │
│  - migrate_app_profiles_to_window_profiles()  [NEW]      │
├──────────────────────────────────────────────────────────┤
│  Platform (crates/platform/src/)                         │
│  - traits.rs: ProcessQuery::window_under_cursor() →      │
│      Option<WindowInfo>                        [NEW]     │
│  - struct WindowInfo {                                   │
│      process_name: String,                               │
│      window_class: String,                               │
│      window_title: String,                               │
│    }                                                      │
│  - windows/process_query.rs:                  [EDIT]     │
│      use GetClassNameW + GetWindowTextW                  │
│  - macos/process_query.rs: stub returning None [EDIT]    │
├──────────────────────────────────────────────────────────┤
│  Tauri (src-tauri/src/hook_wiring.rs)        [EDIT]     │
│  - resolve_active() uses window_under_cursor             │
│  - find_matching_rule() iterates rules, picks            │
│    highest-specificity match                             │
├──────────────────────────────────────────────────────────┤
│  React UI (src/components/settings/)                     │
│  - ProfilesSection.tsx                        [EDIT]     │
│      list shows rules instead of flat process_name       │
│  - WindowRuleEditor.tsx                       [NEW]      │
│      form: process picker + class picker (autocomplete   │
│      from running windows) + title contains              │
│  - tauri.ts                                   [EDIT]     │
│      list_visible_windows() instead of                   │
│      list_visible_processes()                            │
└──────────────────────────────────────────────────────────┘
```

## 3. WindowMatcher semantics

A `WindowProfileRule` matches if **all of**:
1. `matcher.process_name.eq_ignore_ascii_case(window.process_name)`.
2. `matcher.window_class.is_none() || matcher.window_class == Some(window.window_class)`.
3. `matcher.window_title_contains.is_none() || window.window_title.contains(...)`.

Tie-break: **most-specific first**, then `priority`. Specificity = count of non-None matcher fields. With same specificity → higher `priority` wins.

## 4. Win32 implementation

```rust
fn window_under_cursor() -> Option<WindowInfo> {
    let mut pt: POINT = unsafe { mem::zeroed() };
    if unsafe { GetCursorPos(&mut pt) } == 0 { return None; }
    let hwnd = unsafe { WindowFromPoint(pt) };
    if hwnd.is_null() { return None; }

    // Walk up to top-level window for stable class
    let top_hwnd = unsafe { GetAncestor(hwnd, GA_ROOT) };

    let mut class_buf = [0u16; 256];
    let n = unsafe { GetClassNameW(top_hwnd, class_buf.as_mut_ptr(), 256) };
    let window_class = String::from_utf16_lossy(&class_buf[..n as usize]);

    let mut title_buf = [0u16; 512];
    let m = unsafe { GetWindowTextW(top_hwnd, title_buf.as_mut_ptr(), 512) };
    let window_title = String::from_utf16_lossy(&title_buf[..m as usize]);

    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(top_hwnd, &mut pid) };
    let process_name = process_name_from_pid(pid)?;

    Some(WindowInfo { process_name, window_class, window_title })
}
```

Cost benchmark: ~3 syscalls + heap alloc. Expected <50µs. Acceptable for hot path.

## 5. Settings JSON schema (v3)

```json
{
  "schema_version": 3,
  "...": "...",
  "profiles": [...],
  "window_profiles": [
    {
      "matcher": {
        "process_name": "Code.exe",
        "window_class": "Chrome_WidgetWin_1",
        "window_title_contains": null
      },
      "profile_id": "uuid-snappy",
      "priority": 0
    },
    {
      "matcher": {
        "process_name": "Code.exe",
        "window_class": null,
        "window_title_contains": null
      },
      "profile_id": "uuid-default",
      "priority": 0
    }
  ],
  "app_profiles": {}
}
```

### 5.1 Migration v2 → v3

`migrate_app_profiles_to_window_profiles()`:
- For mỗi entry trong `app_profiles`: tạo rule mới với `matcher.process_name = key`, các fields khác None.
- Clear `app_profiles`.
- Bump `schema_version` to 3.
- Idempotent: detect schema_version >= 3 → skip.

## 6. New IPC commands

| Command | Args | Returns |
|---|---|---|
| `list_visible_windows` | — | `Vec<WindowInfo>` |
| `add_window_rule` | `rule: WindowProfileRule` | `Result<(), String>` |
| `remove_window_rule` | `index: usize` | `Result<(), String>` |
| `update_window_rule` | `index, rule` | `Result<(), String>` |

Existing `assign_app_profile` được giữ nhưng deprecate dần (UI hide).

## 7. UI changes

`ProfilesSection.tsx`: section "Per-app rules" trở thành "Window rules". Mỗi row hiển thị:

```
chrome.exe                        → Default      [edit] [delete]
Code.exe / Chrome_WidgetWin_1     → Snappy       [edit] [delete]
EXCEL.EXE / EXCEL7 / "Sheet*"     → Office       [edit] [delete]
```

`WindowRuleEditor.tsx`:
- Picker chọn process (autocomplete từ `list_visible_windows`).
- Picker chọn window_class (autocomplete window classes của process selected, hoặc "Any class").
- Optional text input "Title contains".
- Profile dropdown (existing).

## 8. Migration / risk

- **Schema bump:** old client load v3 settings không sao (`#[serde(default)]` for new field). New client load v2 → migrate.
- **Performance:** mỗi wheel event giờ gọi `window_under_cursor` nặng hơn `process_name_under_cursor` cũ. Mitigation: cache last (hwnd, info) tuple với 16ms TTL.
- **Win32 class names không stable cross version:** ví dụ Chromium-based apps đều dùng `Chrome_WidgetWin_1`. UI gợi ý bao gồm cả title-contains rule.
- **macOS:** `window_class` không tồn tại theo cùng cách. macOS impl returns `None` cho `window_class`, rules với `window_class = None` vẫn hoạt động.

## 9. Testing

| Layer | Test |
|---|---|
| Core | `WindowMatcher` matches process-only rule ✓ |
| Core | `WindowMatcher` matches process+class rule ✓ |
| Core | Most-specific rule wins over generic |
| Core | Equal specificity → higher priority wins |
| Core | Migration v2 → v3 produces equivalent rules |
| Hook wiring | `resolve_active` returns Some when match, None for disabled |
| Manual | VSCode editor uses Snappy, terminal panel uses Default |

## 10. Out of scope

- Glob/regex match cho window_class
- Match by HWND (volatile, useless across launches)
- macOS window-class equivalent (Cocoa subview class)
- Drag-and-drop "magnify" tool để chọn window từ desktop

## 11. Build verification

```bash
cargo test -p smoothscroll_core --test settings_tests
cargo tauri build
```

Smoke:
- [ ] Old settings.json load không lỗi → app_profiles entries → window_profiles rules.
- [ ] Add rule cho VSCode + class `Chrome_WidgetWin_1` + Snappy → smooth feels snappy in editor.
- [ ] No rule cho VSCode terminal class → falls back to global default settings.
