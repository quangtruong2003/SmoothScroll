# Sprint 1 — Performance + UX Hot Path

**Status:** Draft for review
**Date:** 2026-05-19
**Owner:** quangtruong2003
**Scope:** `crates/core`, `crates/platform`, `src-tauri`

---

## 1. Goal

Make scrolling feel instantly responsive and free of jank during burst input (high-rate touchpad, fast wheel flicks), make app-aware profile switching imperceptible when the cursor moves between windows, and keep the settings UI snappy even when toggles are spammed.

The user-perceptible deliverables are:

| Metric | Target |
|---|---|
| Wheel event → engine register p99 latency | < 2 ms |
| Profile switch when cursor crosses windows | < 16 ms (1 frame @ 60 Hz) |
| Settings toggle click → UI redraw | < 16 ms (no disk-write block) |
| Tray icon click → panel visible | < 100 ms |

These targets are validated with criterion benches and manual smoke tests, not just code review.

## 2. Non-Goals

- Error-status banner / hook-failure UX (deferred — was earlier scope, dropped after pivot).
- Engine thread timer rewrite. Current `HighResTimerGuard` stays. Revisit only if benches show frame jitter.
- macOS-specific perf work. Project is Windows-first; the design must not regress macOS but does not chase macOS gains here.
- Single-source-of-truth dedupe of `default_games_list()` vs `app_categories::GAMES` — moved to Sprint 2 (Architecture cleanup).
- Trait API unification (`on_wheel` + `on_wheel_ext`) — Sprint 2.

## 3. Hot-Path Bottlenecks (evidence)

| # | Site | Issue |
|---|---|---|
| 1 | `src-tauri/src/hook_wiring.rs:175-194` and `src-tauri/src/hook_wiring.rs:217-264` | `state.engine.lock()` taken 2-3 times per wheel event (once to read settings, once to register notch, plus signal). Contends with engine thread at 120 Hz. |
| 2 | `src-tauri/src/hook_wiring.rs:97` | `let mut merged = s.clone()` per event clones `Vec<String> excluded_apps`, `Vec<ScrollProfile> profiles`, `HashMap<String,String> app_profiles`. Allocates on the hot path. |
| 3 | `src-tauri/src/hook_wiring.rs:72` | `process_name_under_cursor()` Win32 call invoked on every wheel event when any profile is configured. |
| 4 | `src-tauri/src/hook_wiring.rs:121` and `:129` | `tracing::debug!(?elapsed, process = %process_name, ...)` formats string args before the global filter rejects them. |
| 5 | `src-tauri/src/commands.rs` (every setter that calls `settings::save`) | Synchronous disk write on the Tauri command thread. UI awaits the round-trip. |
| 6 | `src-tauri/src/tray.rs` (panel show path) | Verify panel is preloaded vs. created on click. If created on click, latency is webview-build time. |

## 4. Design

### 4.0 Engine API changes (full surface)

`SmoothScrollEngine` becomes stateless w.r.t. settings. The new public surface:

```rust
// crates/core/src/engine.rs
impl SmoothScrollEngine {
    pub fn new() -> Self;                              // no args
    pub fn on_wheel_with_source(
        &mut self, delta: i32, now_ms: u64,
        source: InputSource, settings: &EffectiveSettings,
    );
    pub fn on_hwheel_with_source(
        &mut self, delta: i32, now_ms: u64,
        source: InputSource, settings: &EffectiveSettings,
    );
    pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput;
    pub fn has_pending_work(&self) -> bool;
}
```

Removed: `apply_settings(&mut self, AppSettings)`, `settings(&self) -> &AppSettings`, `on_wheel(delta, now_ms)`, `on_hwheel(delta, now_ms)` (the no-source variants), and the `settings: AppSettings` field on the struct.

`Default` impl on `SmoothScrollEngine` is provided so `*engine = SmoothScrollEngine::default()` reset still works.

### 4.1 Effective settings split (the core change)

Today `AppState.settings: Arc<RwLock<AppSettings>>` is read on every event. Split it:

```rust
// crates/core/src/settings.rs (new type, alongside AppSettings)

/// Hot-path subset of AppSettings — only fields the engine needs per event.
/// No Vec, no HashMap. Cheap to clone, cheap to swap.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EffectiveSettings {
    pub step_size_px: i32,
    pub animation_time_ms: i32,
    pub acceleration_delta_ms: i32,
    pub acceleration_max: i32,
    pub tail_to_head_ratio: i32,
    pub animation_easing: bool,
    pub easing_mode: EasingMode,
    pub reverse_wheel_direction: bool,
    pub horizontal_smoothness: bool,
    pub shift_key_horizontal: bool,
    pub touchpad_smoothing_enabled: bool,
    pub touchpad_pixel_multiplier: f64,
    pub touchpad_acceleration_factor: f64,
}

impl EffectiveSettings {
    pub fn from_settings(s: &AppSettings) -> Self { /* field copy */ }
    pub fn with_profile(base: &AppSettings, profile: &ScrollProfile) -> Self { /* merged */ }
}
```

`AppState` becomes:

```rust
pub struct AppState {
    // Authoritative store — written by commands, persisted to disk.
    pub settings: Arc<RwLock<AppSettings>>,

    // Hot-path snapshot. Updated whenever `settings` changes or active
    // profile changes. Readers are lock-free (one atomic load + Arc clone).
    pub effective: Arc<arc_swap::ArcSwap<EffectiveSettings>>,

    // ... existing fields unchanged
}
```

`SmoothScrollEngine` is changed to take `&EffectiveSettings` in its hot methods:

```rust
// crates/core/src/engine.rs
pub fn on_wheel_with_source(
    &mut self,
    delta: i32,
    now_ms: u64,
    source: InputSource,
    settings: &EffectiveSettings,   // <-- new
) { ... }
```

The engine no longer owns a copy of `AppSettings`. `apply_settings` is removed; the hook reads `effective.load()` once per event and passes the borrow down. This kills bottleneck #1 and #2.

**Callsites that must be updated** (touch list — exhaustive):

| File | Current call | New call |
|---|---|---|
| `src-tauri/src/engine_thread.rs:79` | `state.engine.lock().step(dt_ms)` | `state.engine.lock().step(dt_ms, &state.effective.load())` |
| `src-tauri/src/edge_scroll_thread.rs:58` | `state.engine.lock().on_wheel(delta, now_ms)` | `state.engine.lock().on_wheel_with_source(delta, now_ms, InputSource::Wheel, &state.effective.load())` |
| `src-tauri/src/commands.rs:107` (inside `set_enabled` reset) | `*e = SmoothScrollEngine::new(s)` | `*e = SmoothScrollEngine::default()` |
| `src-tauri/src/hook_wiring.rs` (route methods) | various — see 4.4 | rewritten per 4.4 |
| `src-tauri/src/keyboard_sink.rs` | `engine.on_wheel(...)` callsite | take a fresh `state.effective.load_full()` before locking the engine — keyboard events are low-frequency so the existing `state.settings.read()` block stays as-is for the keyboard-specific fields (`keyboard_scroll_enabled`, `keyboard_scroll_keys`, `keyboard_smart_text_skip`, `keyboard_pgdn_step_notches`, `keyboard_arrow_step_notches`); they are out of `EffectiveSettings` scope by design |

The keyboard sink is intentionally NOT optimized in this Sprint: keyboard scroll events fire at most a few per second (page-down keypress, etc.), so the `RwLock<AppSettings>` read is not a bottleneck. Only the wheel hot path goes through `EffectiveSettings`.

### 4.2 Pre-merged profile cache

```rust
// AppState
pub effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>,
```

Decision: `RwLock<HashMap>`, not `DashMap`. Writes happen only when a profile or app-assignment changes (rare). Reads happen per-event, but they happen *only when the hook decides to switch profile*, which is also rare (cursor crosses a window edge). DashMap's per-shard locking is unnecessary.

Cache is rebuilt on:
- `save_settings`
- `create_profile` / `update_profile` / `delete_profile`
- `assign_app_profile` / `unassign_app_profile`

Rebuild is cheap: iterate `s.profiles`, build `Arc<EffectiveSettings>` for each id, replace map. No need for incremental updates.

The hook flow:

```rust
fn resolve_active(&self) -> Option<Arc<EffectiveSettings>> {
    // Fast path: no exclusions, no profiles → return current global effective
    let (has_excluded, has_profiles) = {
        let s = self.state.settings.read();
        (!s.excluded_apps.is_empty(), !s.app_profiles.is_empty())
    };
    if !has_excluded && !has_profiles {
        return Some(self.state.effective.load_full());
    }

    let process = self.cached_process_name()?;  // throttled — see 4.3

    let s = self.state.settings.read();
    if s.is_excluded(&process) { return None; }
    if let Some(profile_id) = s.app_profiles.get(&process) {
        if profile_id != AppSettings::DISABLED_PROFILE_ID {
            // Look up pre-built Arc<EffectiveSettings> for this profile
            if let Some(eff) = self.state.effective_per_profile.read().get(profile_id) {
                return Some(eff.clone());  // Arc clone, no settings clone
            }
        }
    }
    Some(self.state.effective.load_full())
}
```

The `last_applied_profile` `Mutex<Option<String>>` and the `apply_settings` round-trip into the engine go away. The engine is stateless w.r.t. settings now — each call carries the settings pointer.

### 4.3 Process-name throttle

```rust
struct ProcessNameCache {
    last_call_at: Instant,
    last_name: Option<String>,
}
```

Held in `EngineSink` behind `Mutex<ProcessNameCache>`. On each `cached_process_name()` call:
- If `last_call_at.elapsed() < 50 ms` → return cached name (Arc clone of `Option<String>`).
- Otherwise call `processes.process_name_under_cursor()`, update cache, return.

Time-only throttle (no cursor-distance heuristic) because the existing `ProcessQuery` trait does not expose cursor coordinates separately from the lookup. Adding cursor-coord parameter would require touching the platform trait, which expands Sprint 1 scope. The 50 ms ceiling caps Win32 syscall rate at 20 Hz worst-case, which already addresses bottleneck #3. The cursor-distance gate can be added in a follow-up if profiling shows the time-only gate is insufficient.

### 4.4 Single critical section per event

After 4.1 the hook callback no longer needs the engine lock to read settings. The new shape:

```rust
fn route_vertical_with_source(&self, delta, mods, source) -> HookDecision {
    if !self.state.enabled.load(Ordering::Relaxed) { return Pass; }
    if self.state.game_mode_active.load(Ordering::Relaxed) { return Pass; }

    let eff = match self.resolve_active() {
        Some(e) => e,
        None => return Pass,  // excluded
    };

    self.update_last_source(source);

    if mods.shift && eff.shift_key_horizontal {
        if !eff.horizontal_smoothness { return Pass; }
        self.state.engine.lock().on_hwheel_with_source(delta, self.now_ms(), source, &eff);
    } else {
        self.state.engine.lock().on_wheel_with_source(delta, self.now_ms(), source, &eff);
    }
    self.state.engine_signal.signal();
    Swallow
}
```

Exactly one `engine.lock()` per event. Contention with the 120 Hz engine thread drops to one critical section per axis register.

### 4.5 Lazy tracing

In `resolve_active`, wrap the slow-path debug logs:

```rust
if tracing::enabled!(tracing::Level::DEBUG) {
    let elapsed = start.elapsed();
    if elapsed > Duration::from_millis(2) {
        tracing::debug!(?elapsed, process = %process_name, "resolve_active slow path");
    }
}
```

Same pattern for the other two slow-path debug sites.

### 4.6 Debounced settings persistence

New module `src-tauri/src/settings_persistor.rs`:

```rust
pub struct SettingsPersistor {
    tx: crossbeam_channel::Sender<Message>,
    handle: Option<JoinHandle<()>>,
}

enum Message {
    Save(AppSettings),
    Shutdown,
}

impl SettingsPersistor {
    pub fn spawn() -> Self { /* ... */ }

    pub fn submit(&self, snapshot: AppSettings) {
        let _ = self.tx.send(Message::Save(snapshot));
    }

    /// Flush pending writes synchronously and stop the worker. Called from
    /// the Tauri `RunEvent::Exit` handler so the final state lands on disk.
    pub fn shutdown(mut self) {
        let _ = self.tx.send(Message::Shutdown);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn worker(rx: Receiver<Message>) {
    const DEBOUNCE: Duration = Duration::from_millis(300);
    let mut pending: Option<AppSettings> = None;
    loop {
        let first = match rx.recv() {
            Ok(Message::Save(s)) => s,
            Ok(Message::Shutdown) | Err(_) => {
                if let Some(s) = pending.take() {
                    let _ = settings::save(&s);
                }
                return;
            }
        };
        pending = Some(first);
        let deadline = Instant::now() + DEBOUNCE;
        loop {
            match rx.recv_deadline(deadline) {
                Ok(Message::Save(s)) => pending = Some(s),
                Ok(Message::Shutdown) => {
                    if let Some(s) = pending.take() {
                        let _ = settings::save(&s);
                    }
                    return;
                }
                Err(_) => break,
            }
        }
        if let Some(s) = pending.take() {
            if let Err(e) = settings::save(&s) {
                tracing::warn!(error = %e, "settings save failed");
            }
        }
    }
}
```

Stored on `AppState` as `pub persistor: Arc<SettingsPersistor>` (Arc so the shutdown call site can take ownership of the inner via a separate handle — see below) — actually simpler: store as `OnceLock<SettingsPersistor>` next to `AppState`, owned by `OwnedHandles` in `lib.rs`. `OwnedHandles::Drop` calls `persistor.shutdown()` which drains and joins.

**Setters affected (exhaustive list, must all switch from `settings::save(&snap)?` to `state.persistor.submit(snap)`):**
- `set_hotkey_enabled`
- `set_hotkey_accelerator`
- `add_excluded_app`
- `remove_excluded_app`
- `set_autostart`
- `change_language`
- `create_profile`
- `update_profile`
- `delete_profile`
- `assign_app_profile`
- `unassign_app_profile`
- `add_known_game`
- `remove_known_game`

**Setters that stay synchronous** (must guarantee disk before return):
- `save_settings` — UI's explicit Save action; frontend may follow up assuming disk state is current.

### 4.7 `commit_settings` helper

Centralize the "mutate authoritative settings → refresh effective → submit to persistor" ritual:

```rust
// src-tauri/src/state.rs
impl AppState {
    /// Atomically replace the authoritative settings, rebuild the hot-path
    /// effective snapshot, rebuild the per-profile cache, and queue a debounced
    /// disk write. This is the ONLY path that should mutate settings.
    pub fn commit_settings(&self, new: AppSettings) {
        let new_eff = EffectiveSettings::from_settings(&new);
        let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
            .profiles
            .iter()
            .map(|p| (p.id.clone(), Arc::new(EffectiveSettings::with_profile(&new, p))))
            .collect();
        {
            let mut w = self.settings.write();
            *w = new.clone();
        }
        self.effective.store(Arc::new(new_eff));
        *self.effective_per_profile.write() = new_per_profile;
        self.persistor.submit(new);
    }
}
```

All command setters now read settings, mutate a clone, and call `state.commit_settings(updated)`. They never touch `effective` or `effective_per_profile` directly.

### 4.8 Tray panel preload — verify, don't fix blind

Before changing anything in `tray.rs`, run a quick measurement: log `Instant::now()` at click-event entry and at the `set_focus()` call. If the gap is < 100 ms, there is nothing to do here. If it's larger, profile what's between them and patch the dominant cost. The design does not commit to a specific tray fix yet — only to measure and act on evidence.

### 4.9 Engine thread — leave alone

Current `engine_thread.rs` already condvar-sleeps when idle and uses adaptive frame rate. The 120 Hz path is fine. Don't touch unless 4.0-4.4 benches show the engine itself is the bottleneck (unlikely — bottlenecks are all in the hook callback).

### 4.10 Cargo fmt precursor

`cargo fmt --all --check` currently fails with extensive diff (many one-line struct/enum bodies, etc.). Run `cargo fmt --all` as the **first commit** of this Sprint, before any logic changes, so the design-driven diff is reviewable in isolation. The fmt commit must touch zero non-formatting changes.

## 5. Data Flow Summary

```
Wheel event
  └─ EngineSink::on_wheel_ext
       ├─ enabled? game-mode? (atomic loads, no lock)
       ├─ resolve_active() ────────────┐
       │   ├─ read settings (RwLock,   │
       │   │   no clone — Vec lengths) │
       │   ├─ if has_profiles:         │
       │   │   ├─ cached_process_name  │
       │   │   │   (throttled Win32)   │
       │   │   └─ effective_per_profile.get → Arc<EffectiveSettings>
       │   └─ else: effective.load_full()
       └─ engine.lock() exactly once   │
           └─ engine.on_wheel_with_source(delta, ts, src, &eff)

Command setter (e.g., set_autostart)
  ├─ mutate AppSettings via RwLock write
  ├─ rebuild effective + effective_per_profile (write the ArcSwap, swap RwLock map)
  ├─ persistor.submit(snapshot)  ──── debounced disk write on background thread
  └─ return immediately
```

## 6. Risks and Trade-offs

| Risk | Mitigation |
|---|---|
| `arc-swap` and `crossbeam-channel` are new dependencies. | Both are well-trusted crates with tiny surface areas (used widely in the Tokio ecosystem). |
| Splitting "authoritative" and "effective" introduces a sync point — bug if a setter forgets to refresh effective. | All setters are required to go through `AppState::commit_settings` (Section 4.7); direct mutation of `effective` or `effective_per_profile` is forbidden. Add a unit test that diff-checks `effective.load()` matches `EffectiveSettings::from_settings(&*state.settings.read())` after each command. |
| Debounced save means a crash within 300 ms of a toggle loses that toggle. | Acceptable for this app — same-state recovery on next launch. `save_settings` (the explicit "Save" path) stays synchronous. The persistor's `RunEvent::Exit` shutdown flushes the pending write so a clean exit never loses state. |
| Process-name throttle could miss a fast cursor sweep across two profile-assigned apps. | 50 ms ceiling means at most one frame of "wrong profile applied" while the cursor is still moving. Imperceptible in practice; revisit only if benches or user reports show otherwise. |
| `set_enabled`'s reset-engine path (`*e = SmoothScrollEngine::default()`) interacts with engine thread holding `&EffectiveSettings` borrows during `step()`. | The engine borrows `&EffectiveSettings` only for the duration of one method call; the lock on `engine` serializes resets vs. steps. No cross-call borrow held. |

## 7. Test Plan

**Unit / integration:**
- `EffectiveSettings::from_settings` and `::with_profile` — straightforward field-mapping tests in `crates/core`.
- `commit_settings` invariant test in `src-tauri`: after each command setter, `*state.effective.load()` equals `EffectiveSettings::from_settings(&*state.settings.read())`.
- `effective_per_profile` map matches `s.profiles` after `create_profile`, `update_profile`, `delete_profile` — keys equal profile ids, values equal `with_profile(&settings, profile)`.
- `cached_process_name` returns cached value when called within 50 ms; calls `processes.process_name_under_cursor()` again after the time window expires (test with a counting `ProcessQuery` stub).
- `SettingsPersistor` debounces multiple submits inside a 300 ms window into a single write (test with a temp-dir `settings_path()` override + write-counter stub).
- `SettingsPersistor::shutdown` flushes the last pending write before returning.
- Hook flow end-to-end: existing tests in `hook_wiring.rs` get updated to construct `AppState` with `effective` and `effective_per_profile` initialized, and the engine API change propagates. The test stub bundle is left as-is in this Sprint (Sprint 2 cleanup).

**Bench (criterion):**

Two bench locations, by layer:

- `crates/core/benches/engine.rs` — pure engine micro-benches. No Tauri, no platform deps.
  - `on_wheel_with_source` per-call cost (notch register).
  - `step` per-call cost across small / medium / large pending pixel deltas.
- `src-tauri/benches/hot_path.rs` — full hook→engine path with stubbed platform.
  - `route_vertical_with_source` baseline (current main, captured before changes) vs. new — wheel event throughput.
  - `resolve_active` with 0 / 1 / 10 profiles configured, cursor over a profile-assigned app vs. an unassigned app.
  - Profile switch cost (cursor moves from non-profile app to profile-assigned app — measures the `effective_per_profile.read().get(profile_id)` path).

Baseline numbers for the "before" side are captured from `master` HEAD before the Sprint commit lands and saved alongside the bench output for the PR.

**Manual smoke:**
- 5-second high-frequency touchpad swipe — visually no jank, no skipped pulses.
- Open 3 windows with different profiles assigned; alt-tab between them while scrolling — no perceived pause on switch.
- Spam a settings toggle 20 times in 2 seconds — UI never freezes; final state on disk matches final UI state after the 300 ms debounce window.
- Force-quit during the 300 ms debounce window — verify the pending write either lands (clean exit via `RunEvent::Exit`) or does not land (process killed — acceptable loss).
- Tray click → panel visible — feels < 100 ms (or measured if instrumented per 4.8).

## 8. Migration / Rollout

**Dependency additions** (`Cargo.toml`):

```toml
# crates/core/Cargo.toml
[dev-dependencies]
criterion = { version = "0.5", default-features = false }

[[bench]]
name = "engine"
harness = false

# src-tauri/Cargo.toml
[dependencies]
arc-swap = "1"
crossbeam-channel = "0.5"

[dev-dependencies]
criterion = { version = "0.5", default-features = false }

[[bench]]
name = "hot_path"
harness = false
```

**Commit sequence** (single PR, multiple reviewable commits):

1. `chore: cargo fmt --all` — pure formatter output, zero logic changes (Section 4.10).
2. `feat(core): add EffectiveSettings and stateless engine API` — introduces type, changes engine signatures, updates engine tests. No `src-tauri` callsite churn yet (engine still constructed with old API in some places — acceptable since Step 3 fixes them).
3. `feat(app): wire effective + effective_per_profile + commit_settings` — `AppState` field additions, `commit_settings` helper, `lib.rs` initialization, `set_enabled` reset path adjustment.
4. `feat(app): debounced settings persistor` — new module + `OwnedHandles` shutdown wiring.
5. `refactor(app): switch all setters to commit_settings + persistor.submit` — the exhaustive setter list from 4.6.
6. `perf(hook): single critical section + process-name throttle + lazy tracing` — `hook_wiring.rs` rewrite per 4.4-4.5; `keyboard_sink.rs` callsite updates.
7. `bench: criterion benches for engine and hook hot path` — adds benches, no production code change.

No persisted-data changes. Settings JSON format unchanged. Behavior changes are all in-process performance.

If reverting becomes necessary, revert is a single `git revert -m 1 <merge-commit>` — no data migration. Individual commits in the sequence above can also be reverted in reverse order if the PR is merged with rebase / fast-forward.

## 9. Out of Scope (Sprint 2 candidates)

- Dedupe games list across `settings::default_games_list` and `app_categories::GAMES`.
- Unify hook trait API (`on_wheel` + `on_wheel_ext` → one method).
- DRY `engine.rs` (`on_wheel_with_source` / `on_hwheel_with_source` extraction).
- Test stub bundle extraction in `hook_wiring.rs` tests.
- Cargo fmt across workspace (run as a no-logic-change precursor commit).
