# SmoothScroll P4 — Keyboard Scroll Smoothing Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe (`WH_KEYBOARD_LL`); macOS later
**Effort:** M (1 week)

## 1. Goal

Smooth scroll cho phím PageUp/PageDown/Space/Shift+Space/Arrow Up/Down. Hiện các phím này gây "jump" tức thì rất chói khi đọc PDF/web/markdown.

## 2. Why this is hard

Không như mouse wheel (event-based, không có concept "key repeat"), keyboard scroll khi giữ phím là **OS-level key repeat** (~30Hz). Ta phải:
1. **Intercept first key down** + emit smooth scroll trị giá X pixel.
2. **Detect autorepeat** — không cho OS deliver thêm phím dồn dập.
3. **Detect key up** → flush remaining scroll.
4. **Tránh false-positives:** PageDown trong Notepad++ khác PageDown trong Browser. **Chỉ kích hoạt nếu foreground window không phải text input control.**

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Platform (crates/platform/src/windows/)                 │
│  - keyboard_scroll_hook.rs                    [NEW]      │
│      WH_KEYBOARD_LL hook trên thread riêng               │
│      maps VK_PRIOR / VK_NEXT / VK_SPACE / VK_UP /        │
│           VK_DOWN / VK_HOME / VK_END                     │
│      detects autorepeat via timing heuristic             │
│  - text_input_detector.rs                     [NEW]      │
│      is_focus_in_text_input() — heuristic via            │
│      GetGUIThreadInfo + class name check                 │
├──────────────────────────────────────────────────────────┤
│  Core (crates/core/src/)                                 │
│  - settings.rs:                                          │
│      keyboard_scroll_enabled: bool (default: false)      │
│      keyboard_scroll_keys: Vec<KeyboardScrollKey>        │
│      keyboard_smart_text_skip: bool (default: true)      │
│  - traits or types: KeyboardScrollKey enum               │
│      PageUp/PageDown/Space/ShiftSpace/ArrowUp/ArrowDown  │
├──────────────────────────────────────────────────────────┤
│  Tauri (src-tauri/src/)                                  │
│  - hook_wiring.rs: KeyboardSink::on_scroll_key()         │
│      converts to wheel-equivalent delta + routes engine  │
│  - lib.rs: install KeyboardScrollHook bên cạnh           │
│    MouseHook (only when keyboard_scroll_enabled)         │
├──────────────────────────────────────────────────────────┤
│  React UI                                                │
│  - components/settings/KeyboardScrollSection.tsx [NEW]   │
│      master toggle + per-key checkboxes + "Skip in       │
│      text inputs" toggle                                 │
└──────────────────────────────────────────────────────────┘
```

## 4. Key → delta mapping

| Key | Equivalent wheel notches | Notes |
|---|---|---|
| PageDown | +5 notches (5 × WHEEL_DELTA = 600) | tunable: `pgdn_step_notches` |
| PageUp | -5 notches | |
| Space | +5 notches | acts as PageDown |
| Shift+Space | -5 notches | acts as PageUp |
| Arrow Down | +1 notch | |
| Arrow Up | -1 notch | |
| Home | snap to top — emit large negative delta | optional |
| End | snap to bottom — large positive | optional |

Multiplier: each notch = `engine.settings.step_size_px` pixels (same as mouse wheel).

## 5. Autorepeat handling

Win32 `KBDLLHOOKSTRUCT.flags` không tin cậy cho autorepeat trên LL hook.

Heuristic:
- Nếu cùng VK đã pressed trong < 50ms gần nhất → autorepeat.

Implementation:
```rust
struct LastKey {
    vk: u32,
    when_ms: u64,
}
static LAST: Mutex<Option<LastKey>> = Mutex::new(None);

fn is_autorepeat(vk: u32, now_ms: u64) -> bool {
    let mut last = LAST.lock();
    let res = matches!(*last, Some(ref k) if k.vk == vk && now_ms - k.when_ms < 50);
    *last = Some(LastKey { vk, when_ms: now_ms });
    res
}
```

Trên `KEY_DOWN`:
- First press → emit scroll, swallow.
- Autorepeat → emit additional scroll (additive into engine), swallow.

Trên `KEY_UP`: clear `LAST` cho VK đó.

## 6. Text-input detection

Goal: skip smoothing nếu user đang typing trong text field. Heuristic chain:

1. `GetGUIThreadInfo(GetWindowThreadProcessId(hwnd))` → `hwndCaret` non-null → likely text input.
2. Class name check: `Edit`, `RichEdit`, `RICHEDIT50W`, `Scintilla`, `OpenEdit`, `_WwG` (Word) → text input.
3. Web browsers: harder — `Chrome_RenderWidgetHostHWND`. Solution: **don't try to detect inside browsers**; rely on user to disable smoothing for editor-like browser apps via per-app rule.

Settings: `keyboard_smart_text_skip: bool` (default ON). User có thể tắt nếu false-positives quá nhiều.

## 7. Settings JSON schema

```json
{
  "...": "...",
  "keyboard_scroll_enabled": false,
  "keyboard_scroll_keys": [
    "PageUp", "PageDown", "Space", "ShiftSpace",
    "ArrowUp", "ArrowDown"
  ],
  "keyboard_smart_text_skip": true,
  "keyboard_pgdn_step_notches": 5,
  "keyboard_arrow_step_notches": 1
}
```

Backward compat: defaults applied via `#[serde(default)]`. `keyboard_scroll_enabled = false` mặc định an toàn.

## 8. New IPC commands

None. UI chỉ patch settings + reload qua existing flow. Backend listens to `keyboard_scroll_enabled` change → install/uninstall hook.

## 9. Migration / risk

- **Default OFF:** feature opt-in để tránh phá flow của user existing.
- **Conflict với app shortcuts:** ví dụ Slack `Space` = play voice message. Mitigation: per-app exclusion (reuse `excluded_apps`/`window_profiles`).
- **Hook installation order:** keyboard hook independent của mouse hook, nhưng cả 2 chia sẻ engine. Threading model: keyboard hook chạy thread riêng, gửi event vào sink (Arc).
- **macOS:** stub — `keyboard_scroll_enabled` setting tồn tại nhưng `KeyboardScrollHook::install` returns `Unsupported`. UI hiển thị "Windows only" badge.
- **Accessibility software conflict:** anti-cheat / screen readers cũng install keyboard hook. Document trong README.

## 10. Testing

| Layer | Test |
|---|---|
| Core | `KeyboardScrollKey::to_notches()` mapping |
| Core | `is_autorepeat` returns true within 50ms |
| Core | Settings default has keyboard_scroll_enabled = false |
| Hook (manual) | PageDown trong Chrome → smooth scroll |
| Hook (manual) | PageDown trong Notepad → still works (no smart-skip) |
| Hook (manual) | PageDown trong Notepad textarea với smart-skip ON → no smoothing, native PageDown nhảy |
| Hook (manual) | Hold PageDown → continuous smooth scroll without staircase |

## 11. Out of scope

- Mac-style natural scroll inertia for keyboard
- Custom keybinding (user remap PageDown to other key)
- Modifier combinations (Ctrl+PageDown navigate tabs vs scroll)
- Browser-specific text-input detection (UIAutomation API)

## 12. Build verification

Smoke:
- [ ] Toggle ON in settings → PageDown trong PDF reader smooth scroll.
- [ ] Hold PageDown 2s → liên tục smooth, không stutter.
- [ ] Type trong Notepad → PageDown nhảy native, không hook.
- [ ] Toggle OFF → restored OS default behavior.
