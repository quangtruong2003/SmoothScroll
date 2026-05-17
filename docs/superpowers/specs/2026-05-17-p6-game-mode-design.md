# SmoothScroll P6 — Game Mode Auto-Disable Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe; macOS later
**Effort:** M (1 week)

## 1. Goal

Tự động tắt smooth scroll khi user đang chơi game ở fullscreen — tránh input lag. Tự động bật lại khi exit fullscreen.

User pain point #1 reported: "When I alt-tab out of game, scroll lag." Hoặc tệ hơn: hook gây input lag trong game.

Competitor (Mos, mosen.io) không có. Killer differentiation.

## 2. Approach: Multi-signal detection

Không dựa vào exe filename (game launcher dynamic, vô tận):

| Signal | Reliability | Cost |
|---|---|---|
| **Foreground window IS fullscreen** (covers monitor exact) | High | Cheap |
| **DXGI fullscreen exclusive flag** | High but admin/perf APIs | Expensive |
| **Process is signed by known game publishers** | Medium | Cheap |
| **Process uses GPU >50% sustained** | Medium | Expensive |

Chọn **fullscreen detection** làm primary signal. Cộng thêm **app-list whitelist of known games** (League of Legends, Valorant, etc.) để cover non-fullscreen games.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Platform (crates/platform/src/windows/)                 │
│  - fullscreen_detector.rs                      [NEW]     │
│      is_foreground_fullscreen() → bool                   │
│      uses GetForegroundWindow + GetMonitorInfo +         │
│      GetWindowRect + comparison                          │
├──────────────────────────────────────────────────────────┤
│  Core (crates/core/src/)                                 │
│  - settings.rs:                                          │
│      game_mode_enabled: bool (default: true)             │
│      game_mode_known_apps: Vec<String>                   │
│        (preset list: League..., user-editable)           │
├──────────────────────────────────────────────────────────┤
│  Tauri (src-tauri/src/)                                  │
│  - game_mode.rs                                [NEW]     │
│      poll thread at 1Hz                                  │
│      checks fullscreen + known_apps list                 │
│      sets state.game_mode_active: AtomicBool             │
│      emits "game-mode-changed" event                     │
│  - hook_wiring.rs: route_*() short-circuits when         │
│      game_mode_active                          [EDIT]    │
│  - state.rs: game_mode_active: AtomicBool      [EDIT]    │
├──────────────────────────────────────────────────────────┤
│  React UI                                                │
│  - components/settings/GameModeSection.tsx     [NEW]     │
│      master toggle (default ON)                          │
│      list of known apps (preset + user-editable)         │
│      live status indicator: 🎮 Game mode active          │
│  - lib/tauri.ts: subscribe to game-mode-changed event    │
└──────────────────────────────────────────────────────────┘
```

## 4. Fullscreen detection

```rust
pub fn is_foreground_fullscreen() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() { return false; }

        // Skip desktop, taskbar
        let mut class_buf = [0u16; 64];
        let n = GetClassNameW(hwnd, class_buf.as_mut_ptr(), 64);
        let class = String::from_utf16_lossy(&class_buf[..n as usize]);
        if class == "Progman" || class == "WorkerW" || class == "Shell_TrayWnd" {
            return false;
        }

        let mut window_rect: RECT = mem::zeroed();
        if GetWindowRect(hwnd, &mut window_rect) == 0 { return false; }

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = mem::zeroed();
        mi.cbSize = mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut mi) == 0 { return false; }

        // Window rect must equal full monitor rect
        window_rect.left == mi.rcMonitor.left &&
        window_rect.top == mi.rcMonitor.top &&
        window_rect.right == mi.rcMonitor.right &&
        window_rect.bottom == mi.rcMonitor.bottom
    }
}
```

Edge cases handled:
- Maximized window: `GetWindowRect` includes shadow area, có thể overshoot monitor rect by 7px → ta dùng equality check, sẽ là false → maximized không trigger game mode. ✓
- Multi-monitor: `MonitorFromWindow` returns correct monitor.

## 5. Polling cadence

1Hz là đủ — game mode entry/exit thường > 1 second. CPU cost trivial.

```rust
fn game_mode_main(state: Arc<AppState>) {
    let mut last_active = false;
    loop {
        if !state.settings.read().game_mode_enabled {
            if last_active {
                state.game_mode_active.store(false, Ordering::Relaxed);
                emit_changed(&state, false);
                last_active = false;
            }
            thread::sleep(Duration::from_secs(1));
            continue;
        }

        let fs = is_foreground_fullscreen();
        let known = is_known_game(&state);
        let now_active = fs || known;

        if now_active != last_active {
            state.game_mode_active.store(now_active, Ordering::Relaxed);
            emit_changed(&state, now_active);
            tracing::info!(active = now_active, "game mode toggled");
            last_active = now_active;
        }

        thread::sleep(Duration::from_secs(1));
    }
}

fn is_known_game(state: &AppState) -> bool {
    let foreground_proc = state.processes.foreground_process_id()
        .and_then(|pid| process_name_from_pid(pid));
    let Some(name) = foreground_proc else { return false; };
    let s = state.settings.read();
    s.game_mode_known_apps.iter().any(|g| g.eq_ignore_ascii_case(&name))
}
```

## 6. Hook short-circuit

In `hook_wiring.rs::route_vertical()`:

```rust
fn route_vertical(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
    if !self.state.enabled.load(Ordering::Relaxed) {
        return HookDecision::Pass;
    }
    // Game mode: pass everything through
    if self.state.game_mode_active.load(Ordering::Relaxed) {
        return HookDecision::Pass;
    }
    // ... existing logic
}
```

Same in `route_horizontal()`.

## 7. Default known games list

Preset (~30 games):
```
LeagueOfLegends.exe, VALORANT.exe, csgo.exe, dota2.exe,
ApexLegends.exe, RainbowSix.exe, FortniteClient-Win64-Shipping.exe,
PUBG.exe, GTAV.exe, RDR2.exe, eldenring.exe, Cyberpunk2077.exe,
witcher3.exe, MinecraftLauncher.exe, javaw.exe (Minecraft),
RocketLeague.exe, Overwatch.exe, hl2.exe, Borderlands3.exe,
Diablo IV.exe, WoW.exe, eve.exe, ffxiv_dx11.exe,
warframe.exe, FactorioBin/factorio.exe, terraria.exe,
StardewValley.exe, ETS2.exe, ats.exe, dishonored2.exe
```

User có thể add/remove qua UI.

## 8. UI

`GameModeSection.tsx`:

```
┌─ Game Mode ─────────────────────────────────────────┐
│                                                      │
│  [✓] Auto-disable in games                          │
│                                                      │
│  Status: 🎮 Active — Smooth scrolling paused        │
│  (live updates from game-mode-changed event)        │
│                                                      │
│  Detection:                                          │
│   • Fullscreen apps (automatic)                      │
│   • Known games in this list:                        │
│     [chip] LeagueOfLegends.exe [×]                  │
│     [chip] VALORANT.exe [×]                         │
│     ... (~30 presets)                                │
│     [+ Add game…]                                    │
└──────────────────────────────────────────────────────┘
```

## 9. Settings JSON schema

```json
{
  "...": "...",
  "game_mode_enabled": true,
  "game_mode_known_apps": [
    "LeagueOfLegends.exe", "VALORANT.exe", ...
  ]
}
```

`#[serde(default)]` ensures backward compat. `game_mode_known_apps` defaults to preset list via `Default` impl.

## 10. New IPC commands + events

| | Args | Returns |
|---|---|---|
| Command `add_known_game` | `name: String` | `Result<(), String>` |
| Command `remove_known_game` | `name: String` | `Result<(), String>` |
| Command `get_game_mode_status` | — | `bool` (current active state) |
| Event `game-mode-changed` | `bool` payload | — |

## 11. Migration / risk

- **Default ON:** vì impact nhỏ (chỉ pass-through trong fullscreen). Risk-free.
- **False positive — fullscreen video player:** VLC/MPC fullscreen sẽ trigger game mode, làm scroll trong taskbar bị disable. Acceptable — user can disable game_mode hoặc rare case.
- **False negative — borderless windowed games:** không là exact monitor rect (1px off) → not detected. Mitigation: known_apps list.
- **Macos:** stub `is_foreground_fullscreen` returns false. Game mode chỉ work qua known_apps list.
- **Race condition khi exit fullscreen:** 1Hz poll = up to 1 second lag re-enabling smooth scroll. Acceptable, user không feel lag từ game.

## 12. Testing

| Layer | Test |
|---|---|
| Core | `is_known_game` case insensitive |
| Platform | `is_foreground_fullscreen` returns false for desktop (`Progman`) |
| Platform | `is_foreground_fullscreen` returns false for taskbar |
| Manual | Launch fullscreen game → status shows Active within 1s |
| Manual | Alt-tab out → status returns to Inactive within 1s |
| Manual | Add custom game to list → minimize game window → still Active |
| Manual | Disable game_mode_enabled → smooth scroll always on |

## 13. Out of scope

- DXGI fullscreen detection (high cost, marginal value)
- GPU usage detection
- Per-game custom profiles (they're disabled, no profile applies)
- macOS Mission Control / Spaces fullscreen detection

## 14. Build verification

```bash
cargo test -p smoothscroll_core
cargo tauri build
```

Smoke:
- [ ] Default settings: launch fullscreen browser → game mode active.
- [ ] Disable game_mode_enabled → no longer activates.
- [ ] Live status badge updates within 1-2s of fullscreen entry/exit.
- [ ] Add custom .exe to known list → minimize window → still triggers.
