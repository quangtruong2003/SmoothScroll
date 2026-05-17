# P4 — Keyboard Scroll Smoothing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smooth scroll cho phím PageUp/PageDown/Space/Shift+Space/Arrow Up/Down. Default OFF. Skip trong text input controls khi smart-skip ON.

**Architecture:** New `WH_KEYBOARD_LL` hook trên thread riêng (Win32). Event sink converts VK → wheel notches → engine.on_wheel. Text-input detector qua GetGUIThreadInfo + class name allowlist.

**Tech Stack:** Rust (smoothscroll_core, smoothscroll_platform), Tauri 2, React + TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-17-p4-keyboard-smoothing-design.md](../specs/2026-05-17-p4-keyboard-smoothing-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `crates/core/src/keyboard_scroll.rs` | CREATE | KeyboardScrollKey enum + to_notches mapping |
| `crates/core/src/lib.rs` | EDIT | Re-export module |
| `crates/core/src/settings.rs` | EDIT | New settings fields |
| `crates/core/tests/keyboard_scroll_tests.rs` | CREATE | Unit tests |
| `crates/platform/src/traits.rs` | EDIT | KeyboardScrollHook + KeyboardScrollSink traits |
| `crates/platform/src/types.rs` | EDIT | KeyboardKeyEvent type |
| `crates/platform/src/windows/keyboard_scroll_hook.rs` | CREATE | WH_KEYBOARD_LL impl |
| `crates/platform/src/windows/text_input_detector.rs` | CREATE | Heuristic detection |
| `crates/platform/src/windows/mod.rs` | EDIT | Exports |
| `crates/platform/src/macos/keyboard_scroll_hook.rs` | CREATE | Stub returning Unsupported |
| `crates/platform/src/macos/mod.rs` | EDIT | Exports |
| `src-tauri/src/keyboard_sink.rs` | CREATE | Routes events to engine |
| `src-tauri/src/state.rs` | EDIT | keyboard_hook, keyboard_handle fields |
| `src-tauri/src/lib.rs` | EDIT | Install/uninstall on settings change |
| `src-tauri/src/commands.rs` | EDIT | save_settings reinstalls hook |
| `src/components/settings/KeyboardScrollSection.tsx` | CREATE | UI |
| `src/lib/tauri.ts` | EDIT | Type updates |

---

## Task 1: Settings fields + defaults

**Files:**
- Modify: `crates/core/src/settings.rs`
- Modify: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Write test**

Append to `crates/core/tests/settings_tests.rs`:

```rust
#[test]
fn keyboard_scroll_defaults_off() {
    let s = AppSettings::default();
    assert!(!s.keyboard_scroll_enabled);
    assert!(s.keyboard_smart_text_skip);
    assert_eq!(s.keyboard_pgdn_step_notches, 5);
    assert_eq!(s.keyboard_arrow_step_notches, 1);
    assert!(s.keyboard_scroll_keys.iter().any(|k| k == "PageDown"));
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test settings_tests keyboard_scroll_defaults_off
```

Expected: FAIL — `no field keyboard_scroll_enabled`.

- [ ] **Step 3: Add fields**

In `crates/core/src/settings.rs`, in `AppSettings`:

```rust
// Keyboard scroll smoothing
pub keyboard_scroll_enabled: bool,
pub keyboard_scroll_keys: Vec<String>,
pub keyboard_smart_text_skip: bool,
pub keyboard_pgdn_step_notches: i32,
pub keyboard_arrow_step_notches: i32,
```

In `Default for AppSettings`:

```rust
keyboard_scroll_enabled: false,
keyboard_scroll_keys: vec![
    "PageUp".to_string(), "PageDown".to_string(),
    "Space".to_string(), "ShiftSpace".to_string(),
    "ArrowUp".to_string(), "ArrowDown".to_string(),
],
keyboard_smart_text_skip: true,
keyboard_pgdn_step_notches: 5,
keyboard_arrow_step_notches: 1,
```

In `clamp()`:

```rust
self.keyboard_pgdn_step_notches = self.keyboard_pgdn_step_notches.clamp(1, 20);
self.keyboard_arrow_step_notches = self.keyboard_arrow_step_notches.clamp(1, 10);
```

- [ ] **Step 4: Run, verify pass**

```bash
cargo test -p smoothscroll_core --test settings_tests keyboard_scroll_defaults_off
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): add keyboard-scroll settings"
```

---

## Task 2: KeyboardScrollKey enum + mapping

**Files:**
- Create: `crates/core/src/keyboard_scroll.rs`
- Create: `crates/core/tests/keyboard_scroll_tests.rs`
- Modify: `crates/core/src/lib.rs`

- [ ] **Step 1: Write tests**

Create `crates/core/tests/keyboard_scroll_tests.rs`:

```rust
use smoothscroll_core::keyboard_scroll::{KeyboardScrollKey, parse_key};

#[test]
fn parse_known_keys() {
    assert_eq!(parse_key("PageDown"), Some(KeyboardScrollKey::PageDown));
    assert_eq!(parse_key("PageUp"), Some(KeyboardScrollKey::PageUp));
    assert_eq!(parse_key("Space"), Some(KeyboardScrollKey::Space));
    assert_eq!(parse_key("ShiftSpace"), Some(KeyboardScrollKey::ShiftSpace));
    assert_eq!(parse_key("ArrowDown"), Some(KeyboardScrollKey::ArrowDown));
    assert_eq!(parse_key("ArrowUp"), Some(KeyboardScrollKey::ArrowUp));
}

#[test]
fn parse_unknown_returns_none() {
    assert_eq!(parse_key("Random"), None);
    assert_eq!(parse_key(""), None);
}

#[test]
fn pgdn_returns_positive_notches() {
    assert_eq!(KeyboardScrollKey::PageDown.to_notches(5, 1), 5);
}

#[test]
fn pgup_returns_negative_notches() {
    assert_eq!(KeyboardScrollKey::PageUp.to_notches(5, 1), -5);
}

#[test]
fn arrow_uses_arrow_step() {
    assert_eq!(KeyboardScrollKey::ArrowDown.to_notches(5, 1), 1);
    assert_eq!(KeyboardScrollKey::ArrowUp.to_notches(5, 2), -2);
}

#[test]
fn space_acts_as_pgdn() {
    assert_eq!(KeyboardScrollKey::Space.to_notches(5, 1), 5);
}

#[test]
fn shift_space_acts_as_pgup() {
    assert_eq!(KeyboardScrollKey::ShiftSpace.to_notches(5, 1), -5);
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test keyboard_scroll_tests
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `crates/core/src/keyboard_scroll.rs`:

```rust
//! Keyboard scroll key mapping. Pure data + functions.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardScrollKey {
    PageUp, PageDown,
    Space, ShiftSpace,
    ArrowUp, ArrowDown,
}

impl KeyboardScrollKey {
    pub fn to_notches(self, pgdn_step: i32, arrow_step: i32) -> i32 {
        match self {
            Self::PageDown | Self::Space => pgdn_step,
            Self::PageUp | Self::ShiftSpace => -pgdn_step,
            Self::ArrowDown => arrow_step,
            Self::ArrowUp => -arrow_step,
        }
    }
}

pub fn parse_key(s: &str) -> Option<KeyboardScrollKey> {
    match s {
        "PageDown" => Some(KeyboardScrollKey::PageDown),
        "PageUp" => Some(KeyboardScrollKey::PageUp),
        "Space" => Some(KeyboardScrollKey::Space),
        "ShiftSpace" => Some(KeyboardScrollKey::ShiftSpace),
        "ArrowUp" => Some(KeyboardScrollKey::ArrowUp),
        "ArrowDown" => Some(KeyboardScrollKey::ArrowDown),
        _ => None,
    }
}
```

Modify `crates/core/src/lib.rs`:

```rust
pub mod keyboard_scroll;
```

- [ ] **Step 4: Run, verify pass**

```bash
cargo test -p smoothscroll_core --test keyboard_scroll_tests
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/keyboard_scroll.rs crates/core/src/lib.rs crates/core/tests/keyboard_scroll_tests.rs
git commit -m "feat(core): add KeyboardScrollKey enum + mapping"
```

---

## Task 3: Platform traits + types

**Files:**
- Modify: `crates/platform/src/types.rs`
- Modify: `crates/platform/src/traits.rs`
- Modify (if needed): `crates/platform/Cargo.toml`

- [ ] **Step 1: Add types**

Append to `crates/platform/src/types.rs`:

```rust
#[derive(Debug, Clone, Copy)]
pub struct KeyboardKeyEvent {
    pub key: smoothscroll_core::keyboard_scroll::KeyboardScrollKey,
    pub is_autorepeat: bool,
}
```

- [ ] **Step 2: Add traits**

Append to `crates/platform/src/traits.rs`:

```rust
use crate::types::KeyboardKeyEvent;

pub trait KeyboardScrollSink: Send + Sync {
    fn on_key(&self, ev: KeyboardKeyEvent) -> HookDecision;
}

pub trait KeyboardScrollHook: Send + Sync {
    fn install(&self, sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle>;
}
```

- [ ] **Step 3: Verify compile**

```bash
cargo check -p smoothscroll_platform
```

Expected: PASS. If `smoothscroll_core` dep missing in platform, add to `crates/platform/Cargo.toml` under `[dependencies]`:

```toml
smoothscroll_core = { workspace = true }
```

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/types.rs crates/platform/src/traits.rs crates/platform/Cargo.toml
git commit -m "feat(platform): KeyboardScrollHook + Sink traits"
```

---

## Task 4: Win32 keyboard hook

**Files:**
- Create: `crates/platform/src/windows/keyboard_scroll_hook.rs`
- Modify: `crates/platform/src/windows/mod.rs`

- [ ] **Step 1: Implementation**

Create `crates/platform/src/windows/keyboard_scroll_hook.rs`:

```rust
#![cfg(windows)]

use crate::traits::{HookHandle, KeyboardScrollHook, KeyboardScrollSink};
use crate::types::{HookDecision, KeyboardKeyEvent, PlatformError, Result};
use parking_lot::Mutex;
use smoothscroll_core::keyboard_scroll::KeyboardScrollKey;
use std::ptr::null_mut;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_DOWN, VK_NEXT, VK_PRIOR, VK_SHIFT, VK_SPACE, VK_UP,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP,
    WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

#[repr(C)]
#[allow(non_snake_case)]
struct KbdllHookStruct {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

const LLKHF_INJECTED: u32 = 0x00000010;

struct HookContext {
    sink: Arc<dyn KeyboardScrollSink>,
    last_vk: Mutex<Option<(u32, Instant)>>,
}

static HOOK_CONTEXT: Mutex<Option<Arc<HookContext>>> = Mutex::new(None);
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);

pub struct WindowsKeyboardScrollHook;

struct InstalledHook {
    thread_id: u32,
    join: Option<thread::JoinHandle<()>>,
}

impl Drop for InstalledHook {
    fn drop(&mut self) {
        unsafe { PostThreadMessageW(self.thread_id, WM_QUIT, 0, 0); }
        if let Some(h) = self.join.take() { let _ = h.join(); }
    }
}

impl KeyboardScrollHook for WindowsKeyboardScrollHook {
    fn install(&self, sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle> {
        *HOOK_CONTEXT.lock() = Some(Arc::new(HookContext {
            sink,
            last_vk: Mutex::new(None),
        }));

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<u32>>(1);
        let join = thread::Builder::new()
            .name("ss-keyboard-hook".into())
            .spawn(move || pump(tx))
            .map_err(|e| PlatformError::Os(format!("spawn keyboard thread: {e}")))?;

        let thread_id = rx.recv()
            .map_err(|_| PlatformError::Os("keyboard thread crashed".into()))??;

        Ok(HookHandle::new(Box::new(InstalledHook {
            thread_id,
            join: Some(join),
        })))
    }
}

fn pump(tx: std::sync::mpsc::SyncSender<Result<u32>>) {
    unsafe {
        let h_module = GetModuleHandleW(null_mut());
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_proc), h_module, 0);
        if hook.is_null() {
            let _ = tx.send(Err(PlatformError::Os("SetWindowsHookExW NULL".into())));
            return;
        }
        HOOK_HANDLE.store(hook as isize, Ordering::SeqCst);
        let _ = tx.send(Ok(GetCurrentThreadId()));

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        let _ = UnhookWindowsHookEx(hook);
        HOOK_HANDLE.store(0, Ordering::SeqCst);
        *HOOK_CONTEXT.lock() = None;
    }
}

unsafe fn shift_pressed() -> bool {
    (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0
}

fn vk_to_key(vk: u32, shift: bool) -> Option<KeyboardScrollKey> {
    match vk {
        x if x == VK_NEXT.0 as u32 => Some(KeyboardScrollKey::PageDown),
        x if x == VK_PRIOR.0 as u32 => Some(KeyboardScrollKey::PageUp),
        x if x == VK_SPACE.0 as u32 => {
            Some(if shift { KeyboardScrollKey::ShiftSpace } else { KeyboardScrollKey::Space })
        }
        x if x == VK_DOWN.0 as u32 => Some(KeyboardScrollKey::ArrowDown),
        x if x == VK_UP.0 as u32 => Some(KeyboardScrollKey::ArrowUp),
        _ => None,
    }
}

unsafe extern "system" fn low_level_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }
    let ctx = match HOOK_CONTEXT.lock().as_ref().cloned() {
        Some(c) => c,
        None => return CallNextHookEx(null_mut(), n_code, w_param, l_param),
    };

    let msg = w_param as u32;
    let data = &*(l_param as *const KbdllHookStruct);

    if (data.flags & LLKHF_INJECTED) != 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let is_down = matches!(msg, x if x == WM_KEYDOWN || x == WM_SYSKEYDOWN);
    let is_up = matches!(msg, x if x == WM_KEYUP || x == WM_SYSKEYUP);

    if is_up {
        let mut last = ctx.last_vk.lock();
        if matches!(*last, Some((v, _)) if v == data.vk_code) {
            *last = None;
        }
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }
    if !is_down {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let Some(key) = vk_to_key(data.vk_code, shift_pressed()) else {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    };

    let mut last = ctx.last_vk.lock();
    let now = Instant::now();
    let is_autorepeat = matches!(*last, Some((v, t)) if v == data.vk_code && now.duration_since(t).as_millis() < 50);
    *last = Some((data.vk_code, now));
    drop(last);

    let decision = ctx.sink.on_key(KeyboardKeyEvent { key, is_autorepeat });
    if matches!(decision, HookDecision::Swallow) {
        1
    } else {
        CallNextHookEx(null_mut(), n_code, w_param, l_param)
    }
}
```

Modify `crates/platform/src/windows/mod.rs`:

```rust
pub mod keyboard_scroll_hook;
pub use keyboard_scroll_hook::WindowsKeyboardScrollHook;
```

- [ ] **Step 2: Verify compile (Windows)**

```bash
cargo check -p smoothscroll_platform --target x86_64-pc-windows-msvc
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/windows/
git commit -m "feat(platform/win): WH_KEYBOARD_LL hook for scroll keys"
```

---

## Task 5: Text-input detector

**Files:**
- Create: `crates/platform/src/windows/text_input_detector.rs`
- Modify: `crates/platform/src/windows/mod.rs`

- [ ] **Step 1: Implementation**

Create `crates/platform/src/windows/text_input_detector.rs`:

```rust
#![cfg(windows)]

use std::mem;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetGUIThreadInfo, GUITHREADINFO,
};
use windows_sys::Win32::System::Threading::GetWindowThreadProcessId;

const TEXT_INPUT_CLASSES: &[&str] = &[
    "Edit", "RichEdit", "RICHEDIT50W", "RichEdit20A", "RichEdit20W",
    "Scintilla", "OpenEdit", "_WwG",
];

pub fn is_focus_in_text_input() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() { return false; }
        let tid = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());
        let mut gti: GUITHREADINFO = mem::zeroed();
        gti.cbSize = mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(tid, &mut gti) == 0 { return false; }

        if !gti.hwndCaret.is_null() {
            return true;
        }
        let focus = if gti.hwndFocus.is_null() { hwnd } else { gti.hwndFocus };
        let mut buf = [0u16; 64];
        let n = GetClassNameW(focus, buf.as_mut_ptr(), buf.len() as i32);
        let class = String::from_utf16_lossy(&buf[..n as usize]);
        TEXT_INPUT_CLASSES.iter().any(|c| *c == class.as_str())
    }
}
```

Modify `crates/platform/src/windows/mod.rs`:

```rust
pub mod text_input_detector;
pub use text_input_detector::is_focus_in_text_input;
```

- [ ] **Step 2: Verify compile**

```bash
cargo check -p smoothscroll_platform --target x86_64-pc-windows-msvc
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/windows/
git commit -m "feat(platform/win): text-input focus detector"
```

---

## Task 6: macOS stub

**Files:**
- Create: `crates/platform/src/macos/keyboard_scroll_hook.rs`
- Modify: `crates/platform/src/macos/mod.rs`

- [ ] **Step 1: Stub**

Create `crates/platform/src/macos/keyboard_scroll_hook.rs`:

```rust
#![cfg(target_os = "macos")]

use crate::traits::{HookHandle, KeyboardScrollHook, KeyboardScrollSink};
use crate::types::{PlatformError, Result};
use std::sync::Arc;

pub struct MacosKeyboardScrollHook;

impl KeyboardScrollHook for MacosKeyboardScrollHook {
    fn install(&self, _sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle> {
        Err(PlatformError::Unsupported)
    }
}
```

Modify `crates/platform/src/macos/mod.rs`:

```rust
pub mod keyboard_scroll_hook;
pub use keyboard_scroll_hook::MacosKeyboardScrollHook;
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/macos/
git commit -m "feat(platform/macos): stub KeyboardScrollHook"
```

---

## Task 7: KeyboardSink in app crate

**Files:**
- Create: `src-tauri/src/keyboard_sink.rs`
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: AppState fields**

Modify `src-tauri/src/state.rs`:

```rust
pub keyboard_hook: Arc<dyn smoothscroll_platform::traits::KeyboardScrollHook>,
pub keyboard_handle: Arc<parking_lot::Mutex<Option<smoothscroll_platform::traits::HookHandle>>>,
```

- [ ] **Step 2: Implement sink**

Create `src-tauri/src/keyboard_sink.rs`:

```rust
use crate::state::AppState;
use smoothscroll_core::constants::WHEEL_DELTA;
use smoothscroll_platform::traits::KeyboardScrollSink;
use smoothscroll_platform::types::{HookDecision, KeyboardKeyEvent};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

pub struct KeyboardEngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
}

impl KeyboardEngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self { state, epoch: Instant::now() })
    }
}

impl KeyboardScrollSink for KeyboardEngineSink {
    fn on_key(&self, ev: KeyboardKeyEvent) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        let s = self.state.settings.read();
        if !s.keyboard_scroll_enabled {
            return HookDecision::Pass;
        }
        let key_str = match ev.key {
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::PageDown => "PageDown",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::PageUp => "PageUp",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::Space => "Space",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ShiftSpace => "ShiftSpace",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ArrowDown => "ArrowDown",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ArrowUp => "ArrowUp",
        };
        if !s.keyboard_scroll_keys.iter().any(|k| k == key_str) {
            return HookDecision::Pass;
        }
        let smart = s.keyboard_smart_text_skip;
        let pgdn = s.keyboard_pgdn_step_notches;
        let arrow = s.keyboard_arrow_step_notches;
        drop(s);

        #[cfg(windows)]
        if smart && smoothscroll_platform::windows::is_focus_in_text_input() {
            return HookDecision::Pass;
        }
        #[cfg(not(windows))]
        let _ = smart;

        let notches = ev.key.to_notches(pgdn, arrow);
        if notches == 0 { return HookDecision::Pass; }
        let delta = notches * WHEEL_DELTA;
        let now_ms = self.epoch.elapsed().as_millis() as u64;
        self.state.engine.lock().on_wheel(delta, now_ms);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}
```

- [ ] **Step 3: Add module to lib.rs**

In `src-tauri/src/lib.rs` near top:

```rust
pub mod keyboard_sink;
```

- [ ] **Step 4: Verify build**

```bash
cargo check -p smoothscroll-app
```

Expected: PASS — but `keyboard_hook` field still needs wiring (Task 8).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/keyboard_sink.rs src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): keyboard scroll sink"
```

---

## Task 8: Install/uninstall on settings change

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/hook_wiring.rs` (test stubs)

- [ ] **Step 1: Wire keyboard_hook in AppState ctor**

In `src-tauri/src/lib.rs`:

```rust
#[cfg(windows)]
let keyboard_hook: Arc<dyn smoothscroll_platform::traits::KeyboardScrollHook> =
    Arc::new(smoothscroll_platform::windows::WindowsKeyboardScrollHook);
#[cfg(target_os = "macos")]
let keyboard_hook: Arc<dyn smoothscroll_platform::traits::KeyboardScrollHook> =
    Arc::new(smoothscroll_platform::macos::MacosKeyboardScrollHook);
```

Add to `AppState { ... }` literal:

```rust
keyboard_hook,
keyboard_handle: Arc::new(parking_lot::Mutex::new(None)),
```

- [ ] **Step 2: Update test stubs**

In `src-tauri/src/hook_wiring.rs` test mod:

```rust
struct StubKeyboardHook;
impl smoothscroll_platform::traits::KeyboardScrollHook for StubKeyboardHook {
    fn install(&self, _sink: Arc<dyn smoothscroll_platform::traits::KeyboardScrollSink>)
        -> smoothscroll_platform::types::Result<smoothscroll_platform::traits::HookHandle> {
        Ok(smoothscroll_platform::traits::HookHandle::new(Box::new(())))
    }
}
```

In `make_state(...)` and `make_state_with_process(...)`:

```rust
keyboard_hook: Arc::new(StubKeyboardHook),
keyboard_handle: Arc::new(parking_lot::Mutex::new(None)),
```

- [ ] **Step 3: Helper to install/uninstall**

Append to `src-tauri/src/commands.rs`:

```rust
pub(crate) fn refresh_keyboard_hook(state: &Arc<AppState>) -> Result<(), String> {
    let enabled = state.settings.read().keyboard_scroll_enabled;
    if enabled {
        if state.keyboard_handle.lock().is_some() {
            return Ok(());
        }
        let sink = crate::keyboard_sink::KeyboardEngineSink::new(state.clone());
        let handle = state.keyboard_hook.install(sink).map_err(|e| e.to_string())?;
        *state.keyboard_handle.lock() = Some(handle);
    } else {
        *state.keyboard_handle.lock() = None;
    }
    Ok(())
}
```

- [ ] **Step 4: Call on startup**

In `src-tauri/src/lib.rs` setup callback, after AppState:

```rust
let _ = crate::commands::refresh_keyboard_hook(&state);
```

- [ ] **Step 5: Re-install on save_settings**

Modify `save_settings` in `src-tauri/src/commands.rs` — at end before `Ok(())`:

```rust
let state_arc: Arc<AppState> = (*state).clone();
let _ = refresh_keyboard_hook(&state_arc);
```

- [ ] **Step 6: Verify build + tests**

```bash
cargo check -p smoothscroll-app
cargo test -p smoothscroll-app
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(tauri): install/uninstall keyboard hook on settings change"
```

---

## Task 9: TS types + UI section

**Files:**
- Modify: `src/lib/tauri.ts`
- Create: `src/components/settings/KeyboardScrollSection.tsx`
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Update AppSettings TS type**

Add to `src/lib/tauri.ts` AppSettings:

```typescript
keyboard_scroll_enabled: boolean;
keyboard_scroll_keys: string[];
keyboard_smart_text_skip: boolean;
keyboard_pgdn_step_notches: number;
keyboard_arrow_step_notches: number;
```

- [ ] **Step 2: Create section**

Create `src/components/settings/KeyboardScrollSection.tsx`:

```tsx
import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS = ["PageUp", "PageDown", "Space", "ShiftSpace", "ArrowUp", "ArrowDown"];

export function KeyboardScrollSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const toggleKey = (key: string) => {
    const enabled = settings.keyboard_scroll_keys.includes(key);
    const next = enabled
      ? settings.keyboard_scroll_keys.filter((k) => k !== key)
      : [...settings.keyboard_scroll_keys, key];
    patch({ keyboard_scroll_keys: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard scroll smoothing <span className="text-xs text-muted-foreground">(Windows only)</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable keyboard smoothing</Label>
          <Switch
            checked={settings.keyboard_scroll_enabled}
            onCheckedChange={(v) => patch({ keyboard_scroll_enabled: v })}
          />
        </div>

        <div>
          <Label>Active keys</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {KEYS.map((k) => {
              const on = settings.keyboard_scroll_keys.includes(k);
              return (
                <button
                  key={k}
                  className={`rounded border px-2 py-0.5 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => toggleKey(k)}
                  disabled={!settings.keyboard_scroll_enabled}
                >{k}</button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>PageUp/PageDown step: {settings.keyboard_pgdn_step_notches} notches</Label>
          <Slider
            min={1} max={20} step={1}
            value={[settings.keyboard_pgdn_step_notches]}
            onValueChange={([v]) => patch({ keyboard_pgdn_step_notches: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>

        <div>
          <Label>Arrow step: {settings.keyboard_arrow_step_notches} notches</Label>
          <Slider
            min={1} max={10} step={1}
            value={[settings.keyboard_arrow_step_notches]}
            onValueChange={([v]) => patch({ keyboard_arrow_step_notches: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Skip in text inputs</Label>
          <Switch
            checked={settings.keyboard_smart_text_skip}
            onCheckedChange={(v) => patch({ keyboard_smart_text_skip: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Register**

In `src/routes/Settings.tsx`, in appropriate tab (Behavior or Scroll):

```tsx
<KeyboardScrollSection />
```

- [ ] **Step 4: Build + dev**

```bash
npx tsc --noEmit && npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/components/settings/KeyboardScrollSection.tsx src/routes/Settings.tsx
git commit -m "feat(ui): keyboard-scroll settings section"
```

---

## Task 10: Final smoke + build

- [ ] **Step 1: Build**

```bash
cargo tauri build
```

Expected: SUCCESS.

- [ ] **Step 2: Manual smoke**

- [ ] Toggle ON → PageDown trong PDF reader → smooth scroll down 5 notches.
- [ ] Hold PageDown 2s → smooth continuous scroll without staircase.
- [ ] Type trong Notepad → PageDown jumps native (skip ON).
- [ ] Disable smart-skip → PageDown smoothes even in Notepad.
- [ ] Disable feature → native PageDown behavior restored.
- [ ] Arrow Down with arrow_step=2 → 2-notch smooth step.

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "chore: P4 final fixes" --allow-empty
```

---

## Self-Review Checklist

- [x] Spec section 3 architecture → Tasks 4, 5, 6, 7, 8
- [x] Spec section 4 key→delta mapping → Task 2
- [x] Spec section 5 autorepeat → Task 4 (timing heuristic)
- [x] Spec section 6 text-input detection → Task 5
- [x] Spec section 7 schema → Task 1
- [x] Spec section 10 testing → Tasks 1, 2 + Task 10 manual
