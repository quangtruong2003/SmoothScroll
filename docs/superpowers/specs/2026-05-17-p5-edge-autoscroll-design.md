# SmoothScroll P5 — Edge Auto-Scroll Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe (cursor poll); macOS later
**Effort:** M (1 week)

## 1. Goal

Khi user đưa cursor gần mép trên/dưới của window (vd top/bottom 40px), tự động scroll continuously với easing — không cần dùng wheel. Tốc độ scroll tỷ lệ với khoảng cách cursor đến mép (gần mép → scroll nhanh hơn).

Killer feature cho:
- Đọc PDF/web dài
- Drag-and-drop kéo file qua list dài
- Code review trên GitHub diff

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Core (crates/core/src/)                                 │
│  - edge_scroll.rs                              [NEW]     │
│      EdgeScrollState struct                              │
│      compute_velocity(cursor_y, window_rect, settings)   │
│      → notches_per_second                                │
├──────────────────────────────────────────────────────────┤
│  Platform (crates/platform/src/windows/)                 │
│  - traits.rs: WindowGeometry trait             [NEW]     │
│      window_under_cursor_rect() → Option<Rect>           │
│  - windows/window_geom.rs                      [NEW]     │
│      uses GetCursorPos + WindowFromPoint +               │
│      GetClientRect + ClientToScreen                      │
│  - macos: stub returns None                               │
├──────────────────────────────────────────────────────────┤
│  Tauri (src-tauri/src/)                                  │
│  - edge_scroll_thread.rs                       [NEW]     │
│      Spawned when settings.edge_scroll_enabled = true    │
│      Polls cursor at 60Hz                                │
│      When in edge zone: calls engine.on_wheel directly   │
│      State machine: Idle → Active → Idle                 │
│  - state.rs: edge_scroll_handle field                    │
│  - commands.rs: install/uninstall on settings change     │
├──────────────────────────────────────────────────────────┤
│  React UI                                                │
│  - components/settings/EdgeScrollSection.tsx   [NEW]     │
│      master toggle                                        │
│      slider: zone size (10-100px)                        │
│      slider: max speed (1-10 notches/sec)                │
│      checkbox: only when modifier held (Alt)             │
└──────────────────────────────────────────────────────────┘
```

## 3. Velocity computation

```rust
pub fn compute_velocity(
    cursor_y: i32,
    window_top: i32,
    window_bottom: i32,
    zone_size_px: i32,
    max_speed: f64,  // notches per second
) -> f64 {
    let from_top = cursor_y - window_top;
    let from_bot = window_bottom - cursor_y;

    if from_top < zone_size_px && from_top >= 0 {
        let intensity = 1.0 - (from_top as f64 / zone_size_px as f64);
        -max_speed * intensity * intensity  // quadratic ramp
    } else if from_bot < zone_size_px && from_bot >= 0 {
        let intensity = 1.0 - (from_bot as f64 / zone_size_px as f64);
        max_speed * intensity * intensity
    } else {
        0.0
    }
}
```

Quadratic ramp = "dead zone" cảm giác tự nhiên: di chuyển 1px gần mép tăng tốc rõ rệt.

## 4. Polling loop

```rust
fn edge_scroll_main(state: Arc<AppState>) {
    let mut last_emit_ms = 0u64;
    let mut accumulated = 0.0f64;

    loop {
        if !state.enabled.load(Ordering::Relaxed) ||
           !state.settings.read().edge_scroll_enabled {
            thread::sleep(Duration::from_millis(100));
            continue;
        }

        let now_ms = epoch_ms();
        let dt = (now_ms - last_emit_ms) as f64 / 1000.0;
        last_emit_ms = now_ms;

        if let Some((cursor, rect)) = state.window_geom.cursor_in_window() {
            let s = state.settings.read();
            let v = compute_velocity(
                cursor.y, rect.top, rect.bottom,
                s.edge_scroll_zone_px, s.edge_scroll_max_notches_per_sec
            );
            if v != 0.0 {
                accumulated += v * dt;
                if accumulated.abs() >= 1.0 {
                    let notches = accumulated.trunc() as i32;
                    accumulated -= notches as f64;
                    let delta = notches * WHEEL_DELTA;
                    state.engine.lock().on_wheel(delta, now_ms);
                    state.engine_signal.signal();
                }
            } else {
                accumulated = 0.0;
            }
        }

        thread::sleep(Duration::from_millis(16));  // ~60Hz
    }
}
```

## 5. Modifier gating (optional)

Nếu `edge_scroll_modifier_required = true`, chỉ active khi user giữ phím Alt (hoặc Shift, configurable). Ngăn false-positive khi user vô tình di chuột vào mép.

Default: OFF — auto-active khi cursor in zone.

## 6. Settings JSON schema

```json
{
  "...": "...",
  "edge_scroll_enabled": false,
  "edge_scroll_zone_px": 40,
  "edge_scroll_max_notches_per_sec": 5.0,
  "edge_scroll_modifier_required": false,
  "edge_scroll_modifier": "Alt"
}
```

Defaults applied via `#[serde(default)]`.

## 7. New IPC commands

None. Edge scroll thread observes settings via existing read lock.

## 8. Migration / risk

- **Default OFF:** opt-in.
- **Performance:** 60Hz cursor poll = ~5MB/s syscall overhead measured. Acceptable.
- **Multi-monitor:** `WindowFromPoint` works cross-monitor.
- **Edge cases:**
  - Cursor on window border vs window content area → use client rect, not window rect.
  - Cursor outside any SmoothScroll-managed app → no scroll.
  - Excluded apps → no edge scroll either.
- **Battery:** trên laptop, 60Hz poll cũng 1-2% CPU. Mitigation: skip poll when settings disabled (already in code), reduce to 10Hz when window not focused.
- **macOS:** `WindowGeometry::cursor_in_window()` stub returns None → edge scroll silently no-op.

## 9. Testing

| Layer | Test |
|---|---|
| Core | `compute_velocity` returns 0 outside zone |
| Core | `compute_velocity` returns negative at top zone |
| Core | `compute_velocity` returns positive at bottom zone |
| Core | Velocity is quadratic — at half zone, intensity = 0.25 |
| Core | Velocity clamped to ±max_speed |
| Manual | Move cursor to bottom of Notepad → scrolls down smoothly |
| Manual | Move cursor away → scroll stops |
| Manual | With modifier required ON, cursor at edge without Alt → no scroll |

## 10. Out of scope

- Horizontal edge scroll (left/right edges)
- Acceleration over time (start slow, ramp up)
- Per-app enable/disable for edge scroll
- Edge scroll in fullscreen apps (overlap với Game mode)

## 11. Build verification

```bash
cargo test -p smoothscroll_core --test edge_scroll_tests
cargo tauri build
```

Smoke:
- [ ] Toggle ON → cursor at bottom 40px of long page → smooth continuous scroll.
- [ ] Toggle OFF → no automatic scroll.
- [ ] Speed slider max → very fast scroll; min → slow.
- [ ] Cursor in middle of window → no scroll.
- [ ] Modifier required + no Alt → no scroll even at edge.
