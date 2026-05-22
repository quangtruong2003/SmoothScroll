# Design: UIA-based Text Input Detection

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Windows only (`crates/platform/src/windows/text_input_detector.rs`)

## Problem

`keyboard_smart_text_skip` — tính năng bỏ qua scroll khi focus đang ở text input — không hoạt động với trình duyệt và Electron apps. Root cause: implementation hiện tại dùng whitelist Win32 class names (`"Edit"`, `"RichEdit"`, v.v.) và kiểm tra Win32 caret (`hwndCaret`). Browsers và Electron render text inputs bằng GPU, dùng class `"Chrome_RenderWidgetHostHWND"` hoặc `"MozillaWindowClass"`, không set Win32 caret. Kết quả: detector trả về `false` khi user đang gõ trong browser text box, SmoothScroll swallow Space thay vì pass qua.

## Solution

Thay thế toàn bộ `text_input_detector.rs` bằng UI Automation (UIA) — Microsoft's accessibility API được thiết kế để bridge native và web content. Tất cả modern browsers (Chrome, Firefox, Edge) và Electron apps implement UIA providers. Khi focus ở web page input, UIA trả về `UIA_EditControlTypeId`; khi ở contenteditable, trả về `UIA_DocumentControlTypeId`.

## Architecture

### File thay đổi

| File | Thay đổi |
|------|---------|
| `crates/platform/src/windows/text_input_detector.rs` | Rewrite hoàn toàn |
| `crates/platform/Cargo.toml` | Thêm `windows` crate (UIA + COM features) |

### File không thay đổi

- `src-tauri/src/keyboard_sink.rs` — call site giữ nguyên
- Settings, UI, macOS code — không đụng

## Implementation

### Logic `is_focus_in_text_input()`

```
1. Kiểm tra cache: nếu result < 50ms tuổi → trả về cached value
2. CoCreateInstance(CUIAutomation) → IUIAutomation
3. automation.GetFocusedElement() → IUIAutomationElement
4. element.GetCurrentControlType() → ControlTypeId
5. Return true nếu type là UIA_EditControlTypeId (32773) hoặc UIA_DocumentControlTypeId (32772)
6. Cache result với timestamp
```

### Cache

- TTL: 50ms — đủ để bỏ qua key repeat events (~30ms interval)
- Storage: `static Mutex<Option<(Instant, bool)>>`
- Invalidation: time-based, không cần manual invalidate

### COM Initialization

`CoInitializeEx(COINIT_MULTITHREADED)` được gọi lazy trên first use. Nếu thread đã init với apartment khác, `S_FALSE` hoặc `RPC_E_CHANGED_MODE` được ignore — UIA vẫn hoạt động trong hầu hết cases.

### UIA Control Types covered

| Type ID | Constant | Covers |
|---------|----------|--------|
| 32773 | `UIA_EditControlTypeId` | `<input>`, native Edit, omnibox |
| 32772 | `UIA_DocumentControlTypeId` | `<textarea>`, contenteditable, rich editors |

### Dependency thêm

```toml
# crates/platform/Cargo.toml — [target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_UI_Accessibility",
    "Win32_System_Com",
] }
```

`windows-sys` giữ nguyên cho toàn bộ code còn lại.

## Error Handling

Mọi COM call đều có thể fail. Tất cả lỗi trả về `false` (không skip scroll) — behavior an toàn: worse case là scroll xảy ra khi không nên, không phải ngược lại.

```
CoCreateInstance fail → return false
GetFocusedElement fail → return false  
GetCurrentControlType fail → return false
```

## Testing

### Automated

Một smoke test Rust: verify `is_focus_in_text_input()` compile và không panic khi không có foreground window (gọi từ test env). Không mock COM — quá phức tạp và ít giá trị.

### Manual verification matrix

| App | Scenario | Expected |
|-----|---------|---------|
| Chrome | Focus vào `<input>` trên web | Skip scroll (true) |
| Chrome | Focus vào `<textarea>` | Skip scroll (true) |
| Chrome | Đang xem trang (không focus input) | Scroll xảy ra (false) |
| Firefox | Focus vào `<input>` | Skip scroll (true) |
| Edge | Focus vào address bar | Skip scroll (true) |
| VS Code (Electron) | Focus vào search/editor | Skip scroll (true) |
| Notepad | Focus vào edit area | Skip scroll (true) |
| Desktop (no focus) | — | Scroll xảy ra (false) |

## Removed

- `TEXT_INPUT_CLASSES` whitelist — UIA cover tất cả cases đó
- `hwndCaret` check — UIA cover luôn
- `GetClassNameW` call — không còn dùng
