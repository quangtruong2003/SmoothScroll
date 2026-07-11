# SmoothScroll — Bug & Issue Report

> Tổng hợp lỗi/bug/rủi ro toàn dự án. Sinh ngày 2026-07-12.
> Độ tin cậy: **[VERIFIED]** = đã đọc tận mắt source code. **[REPORTED]** = do subagent khám phá báo cáo, chưa verify tay.

---

## A. macOS (in development) — lỗi thực sự + rủi ro

### A1. [VERIFIED] Bug keycode F12 trùng F4
- **File:** `crates/platform/src/macos/hotkey.rs:37`
- **Mô tả:** `"f4" => Ok(118)` (line 34) và `"f12" => Ok(118)` (line 37) cùng map về keycode `118`. Hai phím khác nhau không thể chung keycode. macOS virtual keycode chuẩn: F4 = 118, **F12 = 111**.
- **Hậu quả:** Hotkey dùng `F12` sẽ thực tế kích hoạt khi nhấn `F4` (hoặc ngược lại), và đăng ký `F12` trùng key với `F4` đã có → `hotkey '...' already registered` (line 160-164).
- **Sửa:** `line 37: "f12" => Ok(111)`.

### A2. [REPORTED] `read_keycode` dùng field literal `7` sai
- **File:** `crates/platform/src/macos/event_tap.rs:132`
- **Mô tả:** `CGEventGetIntegerValueField(event, 7)` — field chuẩn cho keycode là `kCGKeyboardEventKeycode = 9` (field `7` là keydown flags/unused).
- **Hậu quả:** Hotkey trên macOS có thể đọc sai keycode → không bắt đúng phím.
- **Sửa:** dùng hằng số `kCGKeyboardEventKeycode` (khai báo extern như các field khác line 66-70) thay vì `7`.

### A3. [VERIFIED] `HookDecision::Swallow` bị bỏ qua trên macOS → rủi ro double-scroll
- **File:** `crates/platform/src/macos/event_tap.rs:218-219, 232`
- **Mô tả:** Kết quả `on_wheel_ext`/`on_hwheel_ext` gán vào `_v_decision`/`_h_decision` (không dùng), callback luôn `return event` (line 232). Trên Windows, `Swallow` mới nuốt event gốc; macOS passthrough event gốc VÀ engine vẫn emit pulse synthetic.
- **Hậu quả:** Nếu engine không bù trừ riêng cho macOS, scroll gốc + pulse eased cộng dồn = **double-scroll**. Cần clarify với tác giả (hoặc engine macOS phải chạy instant_mode để không cộng).
- **Sửa:** Xác nhận ý định thiết kế; nếu cần swallow thì xử lý event gốc (set delta = 0) trước khi return.

### A4. [REPORTED] Stubs macOS chưa làm
- `process_name_under_cursor` = `None` (`process_query.rs:50-52`) → không detect app dưới cursor.
- `list_visible_processes` = `Vec::new()` (`process_query.rs:74-76`) → UI picker app rỗng.
- `fullscreen.rs` trả `false` cứng → chưa detect fullscreen (game mode macOS chỉ qua known_apps).
- `window_geom.rs` `cursor_in_window`/`list_monitors` đều stub.

---

## B. Linux — giới hạn chức năng (không crash, nhưng thiếu)

### B1. [REPORTED] X11 double-scroll không thể tránh
- **File:** `crates/platform/src/linux/mouse_hook.rs:6-7`
- **Mô tả:** XInput2 không thể swallow event gốc → smooth scroll cộng dồn lên native scroll. Dùng flag `SUPPRESSING` + `sleep 500µs` để tránh feedback loop tự-inject, nhưng heuristic này có thể miss trên hệ thống tải nặng.
- **Khuyến nghị:** Dùng Wayland (grab độc quyền, không double-scroll). README đã ghi rõ.

### B2. [REPORTED] Wayland hotkey không hoạt động
- **File:** `crates/platform/src/linux/wayland/hotkey.rs:51-66`
- **Mô tả:** Portal `GlobalShortcuts` chưa implement → `Ok(false)`, fallback warning 1 lần, no-op. Hotkey `Ctrl+Alt+S` **không dùng được trên Wayland**.

### B3. [REPORTED] Wayland fullscreen luôn `false`
- **File:** `crates/platform/src/linux/wayland/fullscreen.rs:11-15` → stub. Không auto-bypass fullscreen/game.

### B4. [REPORTED] Wayland `process_name_under_cursor` = `None`
- **File:** `crates/platform/src/linux/wayland/process_query.rs:64-67`. `foreground_process_id` chỉ có trên KDE (qdbus KWin), GNOME → `None`. UI per-app profile hạn chế trên GNOME.

### B5. [REPORTED] Wayland modifier kém tin cậy
- **File:** `crates/platform/src/linux/wayland/keyboard.rs:1-5`. Đọc evdev keyboard raw, comment ghi rõ kém tin cậy hơn X11.

---

## C. React UI — dead code / đặt tên nhầm

### C1. [VERIFIED] `src/lib/settings.ts` — model sai chuẩn, không ai import
- **Mô tả:** Định nghĩa `AppSettings` camelCase (`stepSizePx`, `accelerationDeltaMs`, `shiftKeyHorizontal`, `showTrayIconState`, `startMinimized`, `excludedApps`) hoàn toàn khác model snake_case chuẩn trong `src/lib/tauri.ts` (khớp Rust struct). Không có component nào import file này (per grep subagent).
- **Sửa:** Xóa, hoặc nếu cần default UI-side thì lấy `defaultSettings` từ Rust qua `getDefaultSettings`.

### C2. [VERIFIED] `src/lib/i18n.ts` — stub bị supersede
- **Mô tả:** Chỉ có resource `en` hardcode, init tĩnh. Đã bị thay thế bởi `src/i18n/index.ts` (14 locale, `initI18n`, `setLanguage`) — file này được `main.tsx` gọi.
- **Caveat:** Cần verify không còn import đâu trước khi xóa.

### C3. [REPORTED] `AddAppDialog.tsx` — orphan, không component nào import
- **File:** `src/components/settings/AddAppDialog.tsx`. Quét `list_running_processes`, `onAdd` → `add_excluded_app` nhưng không được mount ở đâu trong tree hiện tại.

### C4. [REPORTED] `ExcludedAppsSection.tsx` — tên file vs nội dung lệch
- **Mô tả:** Tiêu đề section là "App Profiles" (`app_profiles`), nội dung là per-app profile assignment, không phải excluded apps. `AddAppDialog` (excluded) không được file này dùng.

---

## D. Landing — test/impl gap

### D1. [REPORTED] E2E dot-grid đòi mouse-tracking nhưng impl static
- **File:** `landing/e2e/dot-grid-overlay.spec.ts:31-52` vs `landing/components/BackgroundDotGrid.tsx`.
- **Mô tả:** Test kỳ vọng `--mx/--my` CSS vars thay đổi trên mousemove; code hiện tại là static `<div>` + CSS radial-gradient (`globals.css:97-110`), không có mousemove handler. Test sẽ fail hoặc assert sai behaviour.
- **Sửa:** Nâng cấp dot-grid thành mouse-tracking (docs `2026-05-18-background-dot-grid-design.md` đã phê duyệt cursor-follow light) HOẶC sửa test thành assert static.

---

## E. src-tauri — dead path / duplicate

### E1. [REPORTED] macOS IPC socket server chưa ship nhưng vẫn kéo tokio
- **File:** `src-tauri/src/ipc_socket_server.rs` + `Cargo.toml`.
- **Mô tả:** Unix socket JSON-RPC backend cho Swift MenuBar app. Non-macOS là no-op stub; trên macOS vẫn được gọi trong `lib.rs:227` nhưng subagent báo "chưa ship đầy đủ" (Tauri tray đang dùng thay). `Cargo.toml` vẫn kéo `tokio` chỉ cho macOS path này.

### E2. [REPORTED] Duplicate import `use crate::state::AppState`
- **File:** `src-tauri/src/ipc_socket_server.rs:12` và `:31`. Compile được nhưng thừa.

---

## F. Cross-cutting — mismatch trạng thái macOS

### F1. [VERIFIED + REPORTED] Mâu thuẫn: Swift app hoàn thiện nhưng Rust IPC backend chưa rõ
- **Swift client** (`macos/SmoothScrollMenuBar`): IPC client Unix socket hoàn thiện, auto-reconnect, graceful shutdown gửi `quit` xuống Rust.
- **Rust backend** (`ipc_socket_server.rs`): subagent src-tauri báo "chưa ship". Docs `SPEC-macos` nói macOS skip Tauri tray, dùng Swift làm tray duy nhất.
- **Rủi ro:** Nếu Rust backend socket chưa wire vào `lib.rs` đúng, Swift app không thể giao tiếp với engine. Cần verify `lib.rs:227` đã connect socket + dispatch methods (`get_settings`, `set_scroll_enabled`, `set_preset`, `save_settings`, `quit`) chưa.

---

## G. Tóm tắt độ ưu tiên

| ID | Vùng | Mức | Trạng thái | Hành động |
|----|------|-----|-----------|-----------|
| A1 | macOS hotkey | 🔴 High | VERIFIED | Sửa 1 dòng (F12=111) |
| A2 | macOS keycode | 🔴 High | REPORTED | Sửa field 7→9 |
| A3 | macOS double-scroll | 🔴 High | VERIFIED | Clarify + sửa swallow |
| A4 | macOS stubs | 🟡 Med | REPORTED | Làm tiếp (roadmap) |
| B1 | Linux X11 double | 🟡 Med | REPORTED | Dùng Wayland |
| B2 | Wayland hotkey | 🟠 High | REPORTED | Cần portal |
| B3/B4 | Wayland fs/process | 🟡 Med | REPORTED | Stub |
| C1 | UI dead settings.ts | 🟢 Low | VERIFIED | Xóa |
| C2 | UI dead i18n.ts | 🟢 Low | VERIFIED | Verify + xóa |
| C3 | AddAppDialog orphan | 🟢 Low | REPORTED | Wire hoặc xóa |
| C4 | Tên section lệch | 🟢 Low | REPORTED | Đổi tên |
| D1 | Landing E2E gap | 🟡 Med | REPORTED | Sync test/impl |
| E1 | macOS socket dead | 🟡 Med | REPORTED | Verify wire |
| E2 | Duplicate import | 🟢 Low | REPORTED | Xóa 1 dòng |
| F1 | macOS mismatch | 🟠 High | VERIFIED+REPORTED | Verify lib.rs |

**Ưu tiên cao nhất:** A1 (sửa ngay, 1 dòng), A3 (clarify thiết kế macOS), F1 (verify tích hợp Swift↔Rust), B2 (hotkey Wayland).
