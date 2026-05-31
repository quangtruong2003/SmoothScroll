# SmoothScroll macOS Menu Bar App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Menu Bar utility app that provides smooth scrolling and direction sync between trackpad and mouse, using a hybrid Rust engine + Swift UI architecture.

**Architecture:** The Rust scroll engine lives in `crates/platform/src/macos/` and communicates with a standalone Swift Menu Bar app via a Unix domain socket (JSON-RPC 2.0). The Swift app has no Dock icon (LSUIElement), lives entirely in the Menu Bar with an NSPopover, and links to System Settings for deep preferences.

**Tech Stack:** Rust (CGEventTap, core-graphics, objc2), Swift 5.9+ / SwiftUI, XcodeGen, Carbon RegisterEventHotKey, LaunchAgent for autostart.

---

## File Structure

```
crates/platform/src/macos/
  event_tap.rs          (NEW)  CGEventTap scroll interception
  wheel_emitter.rs      (MOD)  Replace stub with real CGEvent emission
  mouse_hook.rs         (MOD)  Wrap event_tap in MouseHook trait
  permissions.rs        (MOD)  Implement is_trusted() with AX API
  process_query.rs      (MOD)  Implement remaining ProcessQuery methods
  fullscreen.rs         (MOD)  Real fullscreen detection via CGWindowList
  window_geom.rs        (MOD)  Real window geometry
  mod.rs                (MOD)  Wire everything, add ZoomEmitter

crates/platform/Cargo.toml       (MOD)  Add core-foundation, core-graphics, dispatch deps
crates/platform/src/lib.rs       (MOD)  Add ZoomEmitter to macOS Platform bundle

src-tauri/src/
  ipc_socket_server.rs  (NEW)  Unix socket JSON-RPC server for Swift IPC

src-tauri/Cargo.toml     (MOD)  Add tokio for async socket server

macos/SmoothScrollMenuBar/
  project.yml                     (NEW)  XcodeGen project definition
  Sources/App/main.swift          (NEW)  NSApplication entry point
  Sources/App/AppDelegate.swift   (NEW)  App lifecycle, hotkey setup
  Sources/MenuBar/MenuBarController.swift  (NEW)  NSStatusItem + NSPopover
  Sources/Views/SmoothScrollPopover.swift   (NEW)  Main popover SwiftUI view
  Sources/Views/SmoothScrollSection.swift    (NEW)  Section 1: toggle + slider
  Sources/Views/DirectionSyncSection.swift   (NEW)  Section 2: toggle + visual
  Sources/Views/PresetShortcutsView.swift    (NEW)  Footer with ⌘1/2/3
  Sources/Views/SettingsRow.swift            (NEW)  Reusable toggle row
  Sources/Views/VisualEffectBlur.swift       (NEW)  NSVisualEffectView wrapper
  Sources/IPC/IPCClient.swift                (NEW)  Unix socket JSON-RPC client
  Sources/IPC/IPCProtocol.swift              (NEW)  IPC message types
  Sources/Settings/SettingsStore.swift       (NEW)  @Published settings state
  Sources/Resources/Info.plist               (NEW)  LSUIElement, usage descriptions
  Sources/Resources/SmoothScrollMenuBar.entitlements  (NEW)  App entitlements

.github/workflows/auto-release.yml  (MOD)  Enable + update build-macos job
```

---

## Task 1: Add macOS Rust Dependencies

**Files:**
- Modify: `crates/platform/Cargo.toml`
- Test: `cd crates/platform && cargo check --target aarch64-apple-darwin` (after toolchain install)

- [ ] **Step 1: Add core-graphics, core-foundation, and dispatch dependencies**

```toml
[target.'cfg(target_os = "macos")'.dependencies]
# Existing:
objc2 = { version = "0.5", default-features = false, features = ["std"] }
objc2-app-kit = { version = "0.2", default-features = false, features = ["std", "NSWorkspace", "NSRunningApplication", "NSResponder"] }
objc2-foundation = { version = "0.2", default-features = false, features = ["std", "NSString"] }

# NEW:
core-foundation = "0.10"
core-graphics = "0.19"
dispatch = "2"
```

**How:** Find the `[target.'cfg(target_os = "macos")'.dependencies]` section in `crates/platform/Cargo.toml` and append the three new crate entries after the existing objc2 lines.

- [ ] **Step 2: Verify cargo parses without errors**

Run: `cargo check -p smoothscroll-platform --target aarch64-apple-darwin --lib` (requires macOS Rust target installed)

If target not installed: `rustup target add aarch64-apple-darwin` then retry.

Expected: No parse errors, compilation errors expected (other files still have stubs).

- [ ] **Step 3: Commit**

```bash
git add crates/platform/Cargo.toml
git commit -m "chore(macos): add core-graphics, core-foundation, dispatch deps for CGEventTap"
```

---

## Task 2: Implement CGEventTap Scroll Interception

**Files:**
- Create: `crates/platform/src/macos/event_tap.rs`
- Test: `crates/platform/src/macos/event_tap.rs` (compile check)

- [ ] **Step 1: Write the event tap implementation**

Create `crates/platform/src/macos/event_tap.rs` with the following complete implementation:

```rust
//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap at `kCGHIDEventTap` that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then emits synthetic wheel events with the smooth-scroll
//! delta applied.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use crate::types::{HookDecision, ModifierKeys, PlatformError, Result};
use core_graphics::event::{CGEvent, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use core_graphics::EventField;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// The scrolling delta above which we treat an event as a high-resolution
/// trackpad scroll (continuous) vs a mouse wheel (discrete notches).
const TRACKPAD_CONTINUOUS_THRESHOLD: i64 = 10;

/// Classifies a scroll event's input source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrollInputSource {
    /// Standard mouse scroll wheel (discrete notches).
    Mouse,
    /// High-resolution trackpad / magic mouse (continuous, fractional deltas).
    Trackpad,
}

impl ScrollInputSource {
    fn from_event(event: &CGEvent) -> Self {
        // kCGScrollWheelEventIsContinuous is 0x100 in the event flags field.
        let is_continuous = event
            .get_integer_value_field(EventField::scrollWheelEventIsContinuous as i32)
            != 0;
        if is_continuous {
            Self::Trackpad
        } else {
            Self::Mouse
        }
    }
}

/// Reads modifier keys from a CGEvent.
fn read_modifiers(event: &CGEvent) -> ModifierKeys {
    let flags = event.flags();
    ModifierKeys {
        shift: flags.contains(core_graphics::event::CGEventFlags::SHIFT),
        ctrl: flags.contains(core_graphics::event::CGEventFlags::CONTROL),
        alt: flags.contains(core_graphics::event::CGEventFlags::OPTION),
        // CGEventFlags doesn't expose Command directly; check via key code.
        // For simplicity we derive it from the event source state.
        cmd: {
            let source = event.source();
            source
                .map(|s| s.state() == CGEventSourceStateID::CombinedSessionState)
                .unwrap_or(false)
        },
    }
}

/// Reads vertical scroll delta from a CGEvent.
fn read_vertical_delta(event: &CGEvent) -> i64 {
    // Try continuous (trackpad) field first.
    let delta = event.get_integer_value_field(EventField::scrollWheelEventDeltaAxis2 as i32);
    if delta != 0 {
        return delta;
    }
    // Fall back to discrete field.
    event.get_integer_value_field(EventField::scrollWheelEventPointDeltaAxis2 as i32)
}

/// Reads horizontal scroll delta from a CGEvent.
fn read_horizontal_delta(event: &CGEvent) -> i64 {
    let delta = event.get_integer_value_field(EventField::scrollWheelEventDeltaAxis1 as i32);
    if delta != 0 {
        return delta;
    }
    event.get_integer_value_field(EventField::scrollWheelEventPointDeltaAxis1 as i32)
}

/// Creates and runs the event tap, calling `sink` for each scroll event.
/// Returns when `stop` is set to true.
pub fn run_event_loop(
    sink: Arc<dyn HookEventSink>,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    // Create the event tap.
    let tap = CGEventTap::new(
        CGEventTapLocation::HIDSystem,
        CGEventTapPlacement::HeadInsertEventTap,
        CGEventTapOptions::Default,
        // We want scroll events (category kCGEventScrollWheel).
        vec![
            CGEventType::ScrollWheel.as_cgtype(),
            CGEventType::TabletPointer.as_cgtype(),
        ],
        move |_event_type, event| {
            // Classify input source.
            let source = ScrollInputSource::from_event(event);
            let v_delta = read_vertical_delta(event) as i32;
            let h_delta = read_horizontal_delta(event) as i32;
            let mods = read_modifiers(event);

            // Call the sink for each axis.
            let v_decision = sink.on_wheel_ext(v_delta, mods, match source {
                ScrollInputSource::Trackpad => smoothscroll_core::input_source::InputSource::Touchpad,
                ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
            });
            let h_decision = sink.on_hwheel_ext(h_delta, match source {
                ScrollInputSource::Trackpad => smoothscroll_core::input_source::InputSource::Touchpad,
                ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
            });

            // If either sink swallowed the event, we would need to post replacement
            // events. Currently this module just observes — wheel emission is handled
            // by wheel_emitter.rs.
            Some(event)
        },
    )
    .ok_or_else(|| PlatformError::PermissionDenied)?;

    // Enable the tap.
    tap.set_enabled(true).map_err(|e| PlatformError::Os(e.to_string()))?;

    // Create an event source so we can post synthetic events.
    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .ok_or_else(|| PlatformError::Os("failed to create CGEventSource".into()))?;

    // Run loop — drain events from the tap.
    let mut event_buffer = vec![std::ptr::null_mut(); 1];
    loop {
        if stop.load(Ordering::Relaxed) {
            break;
        }
        // Use CGEvent.tap_create requires a mach port; instead we use
        // the run loop source approach via dispatch.
        // For simplicity here we poll using a timeout.
        std::thread::sleep(std::time::Duration::from_millis(16));
    }

    tap.set_enabled(false).ok();
    Ok(())
}
```

**Note:** This is a simplified first-pass implementation. The actual `run_event_loop` needs to use `CGEvent.tapCreate` with a Mach port and a dedicated thread running `CFRunLoop`. See Task 2b for the complete version.

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p smoothscroll-platform --target aarch64-apple-darwin --lib`

Expected: FAIL — `core_graphics::event::CGEventType::ScrollWheel` may not have `.as_cgtype()` and the event tap API in `core-graphics` 0.19 differs from what was assumed. Iterate until it compiles.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/macos/event_tap.rs
git commit -m "feat(macos): add CGEventTap scroll interception stub"
```

---

## Task 3: Replace wheel_emitter.rs Stub with Real CGEvent Emission

**Files:**
- Modify: `crates/platform/src/macos/wheel_emitter.rs`
- Test: compile check

- [ ] **Step 1: Replace stub with real CGEvent emission**

```rust
//! macOS wheel emitter via CGEvent.post().
//!
//! Posts synthetic scroll wheel events to the HID event tap, replacing
//! the original unsmoothed wheel deltas with our smooth animation pulses.

#![cfg(target_os = "macos")]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use core_graphics::event::{CGEvent, CGEventType};
use core_graphics::event_source::CGEventSource;
use core_graphics::EventField;

/// Scaled down: CG scroll deltas are in "notch" units where 1.0 = one
/// mouse wheel notch. Our engine works in pixels; convert back.
const SCROLL_TO_NOTCH_MULTIPLIER: f64 = 0.1;

pub struct MacosWheelEmitter {
    source: std::sync::OnceLock<CGEventSource>,
}

impl MacosWheelEmitter {
    pub fn new() -> Self {
        Self {
            source: std::sync::OnceLock::new(),
        }
    }

    fn get_source(&self) -> Result<&CGEventSource> {
        self.source
            .get_or_try_init(|| {
                CGEventSource::new(core_graphics::event_source::CGEventSourceStateID::CombinedSessionState)
                    .ok_or(PlatformError::Os("failed to create CGEventSource".into()))
            })
            .map_err(|e| PlatformError::Os(e.to_string()))
    }
}

impl Default for MacosWheelEmitter {
    fn default() -> Self {
        Self::new()
    }
}

impl WheelEmitter for MacosWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        let source = self.get_source()?;
        // Post a vertical wheel event.
        if vertical_units != 0 {
            let event = CGEvent::new(source)
                .map_err(|e| PlatformError::Os(e.to_string()))?;
            event.set_type(CGEventType::ScrollWheel);
            // Use discrete (notch) units for the delta.
            event.set_integer_value_field(
                EventField::scrollWheelEventPointDeltaAxis2 as i32,
                vertical_units as i64,
            );
            event.post(CGEventTapLocation::HIDSystem);
        }
        // Post a horizontal wheel event.
        if horizontal_units != 0 {
            let event = CGEvent::new(source)
                .map_err(|e| PlatformError::Os(e.to_string()))?;
            event.set_type(CGEventType::ScrollWheel);
            event.set_integer_value_field(
                EventField::scrollWheelEventPointDeltaAxis1 as i32,
                horizontal_units as i64,
            );
            event.post(CGEventTapLocation::HIDSystem);
        }
        Ok(())
    }
}

impl ZoomEmitter for MacosWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        let source = self.get_source()?;
        // Zoom is Ctrl+Wheel. Post a scroll wheel with the Ctrl modifier.
        let event = CGEvent::new(source)
            .map_err(|e| PlatformError::Os(e.to_string()))?;
        event.set_type(CGEventType::ScrollWheel);
        event.set_integer_value_field(
            EventField::scrollWheelEventPointDeltaAxis2 as i32,
            units as i64,
        );
        use core_graphics::event::CGEventFlags;
        event.set_flags(CGEventFlags::CONTROL);
        event.post(CGEventTapLocation::HIDSystem);
        Ok(())
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p smoothscroll-platform --target aarch64-apple-darwin --lib`

Expected: FAIL if `CGEventType::ScrollWheel` enum variant or `EventField` constants don't exist. Fix API calls based on actual `core-graphics` 0.19 API.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/macos/wheel_emitter.rs
git commit -m "feat(macos): implement wheel emitter with CGEvent.post()"
```

---

## Task 4: Implement is_trusted() in permissions.rs

**Files:**
- Modify: `crates/platform/src/macos/permissions.rs`
- Test: compile check

- [ ] **Step 1: Implement is_trusted with AXIsProcessTrustedWithOptions**

```rust
//! macOS accessibility permission check.
//!
//! Uses the ApplicationKit Accessibility API to determine whether this
//! process has been granted accessibility permissions (required for
//! CGEventTap to intercept scroll events).

#![cfg(target_os = "macos")]

use core_graphics::appkit::{AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt};

/// Returns true if Accessibility permission is granted.
///
/// If `_prompt` is true and permission is not yet granted, the system
/// will display the standard "Accessibility access required" dialog.
pub fn is_trusted(prompt: bool) -> bool {
    if prompt {
        // Trigger the permission dialog if not already granted.
        let options = std::collections::HashMap::from([
            (kAXTrustedCheckOptionPrompt, true),
        ]);
        // AXIsProcessTrustedWithOptions takes a CFDictionary.
        // SAFETY: the dict is populated with valid values and immediately
        // consumed by the call.
        let dict = unsafe {
            use core_graphics::base::CFDictionary;
            CFDictionary::from_CFMutableDictionary(
                options
                    .into_iter()
                    .map(|(k, v)| (k, v as core_graphics::base::CFTypeRef))
                    .collect::<std::collections::HashMap<_, _>>()
                    .into(),
            )
        };
        let trusted = unsafe { AXIsProcessTrustedWithOptions(dict) };
        trusted
    } else {
        // Just check without prompting.
        unsafe { AXIsProcessTrustedWithOptions(std::ptr::null()) }
    }
}
```

**Note:** `AXIsProcessTrustedWithOptions` and `kAXTrustedCheckOptionPrompt` may not be exposed in `core-graphics` 0.19. May need to use raw FFI through `objc2` instead.

- [ ] **Step 2: Verify compilation**

Run: `cargo check -p smoothscroll-platform --target aarch64-apple-darwin --lib`

Expected: FAIL — fix API calls based on what's actually available in `core-graphics` 0.19.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/macos/permissions.rs
git commit -m "feat(macos): implement is_trusted accessibility check"
```

---

## Task 5: Implement macOS Platform Bundle — Wire Everything Together

**Files:**
- Modify: `crates/platform/src/macos/mod.rs`
- Modify: `crates/platform/src/lib.rs` (add ZoomEmitter)
- Test: compile check

- [ ] **Step 1: Add ZoomEmitter to Platform struct in lib.rs**

In `crates/platform/src/lib.rs`, the `Platform` struct is missing `zoom_emitter`. Find it and add:

```rust
pub struct Platform {
    pub mouse_hook: Arc<dyn MouseHook>,
    pub wheel_emitter: Arc<dyn WheelEmitter>,
    pub zoom_emitter: Arc<dyn ZoomEmitter>,   // <-- ADD THIS
    pub process_query: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub accessibility: Arc<dyn AccessibilitySignals>,
}
```

- [ ] **Step 2: Update macOS build() to include zoom_emitter**

In `crates/platform/src/macos/mod.rs`, update `build()`:

```rust
use crate::traits::{..., ZoomEmitter};

pub fn build() -> Result<Platform> {
    Ok(Platform {
        mouse_hook: Arc::new(MacosMouseHook::new()),
        wheel_emitter: Arc::new(MacosWheelEmitter::new()),
        zoom_emitter: Arc::new(MacosWheelEmitter::new()), // Same struct implements both
        process_query: Arc::new(MacosProcessQuery::new()),
        autostart: Arc::new(MacosAutostart),
        hotkey: Arc::new(MacosHotkey),
        accessibility: Arc::new(MacosAccessibilitySignals),
    })
}
```

- [ ] **Step 3: Verify full macOS platform compiles**

Run: `cargo check -p smoothscroll-platform --target aarch64-apple-darwin --lib`

Expected: FAIL — iterate on type errors until it compiles.

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/lib.rs crates/platform/src/macos/mod.rs
git commit -m "feat(macos): wire platform bundle with ZoomEmitter"
```

---

## Task 6: Build macOS IPC Socket Server (src-tauri)

**Files:**
- Create: `src-tauri/src/ipc_socket_server.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `cargo check -p smoothscroll-app --lib`

- [ ] **Step 1: Add tokio to src-tauri/Cargo.toml**

```toml
[dependencies]
# Add under existing dependencies:
tokio = { version = "1", features = ["net", "rt-multi-thread", "macros", "sync", "codec", "io-util"] }
serde_json = "1"
```

- [ ] **Step 2: Write the IPC socket server**

Create `src-tauri/src/ipc_socket_server.rs`:

```rust
//! Unix domain socket IPC server for communication with the Swift Menu Bar app.
//!
//! Listens on `~/.smoothscroll/socket` and handles JSON-RPC 2.0 requests.
//! Commands: get_scroll_enabled, set_scroll_enabled, get_direction_sync_enabled,
//! set_direction_sync_enabled, get_preset, set_preset, get_settings, save_settings, quit.
//!
//! Events emitted to connected clients: scroll_state_changed, direction_sync_changed,
//! preset_changed.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "params")]
pub enum IpcRequest {
    #[serde(rename = "get_scroll_enabled")]
    GetScrollEnabled,
    #[serde(rename = "set_scroll_enabled")]
    SetScrollEnabled { enabled: bool },
    #[serde(rename = "get_direction_sync_enabled")]
    GetDirectionSyncEnabled,
    #[serde(rename = "set_direction_sync_enabled")]
    SetDirectionSyncEnabled { enabled: bool },
    #[serde(rename = "get_preset")]
    GetPreset,
    #[serde(rename = "set_preset")]
    SetPreset { preset: String },
    #[serde(rename = "get_settings")]
    GetSettings,
    #[serde(rename = "save_settings")]
    SaveSettings { settings: serde_json::Value },
    #[serde(rename = "quit")]
    Quit,
}

#[derive(Debug, Clone, Serialize)]
pub struct IpcResponse {
    pub id: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<IpcError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IpcError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event")]
pub enum IpcEvent {
    #[serde(rename = "scroll_state_changed")]
    ScrollStateChanged { enabled: bool },
    #[serde(rename = "direction_sync_changed")]
    DirectionSyncChanged { enabled: bool },
    #[serde(rename = "preset_changed")]
    PresetChanged { preset: String },
}

pub struct IpcServer {
    path: PathBuf,
    shutdown_rx: tokio::sync::watch::Receiver<()>,
    /// Broadcast channel for events to connected clients.
    event_tx: broadcast::Sender<IpcEvent>,
}

impl IpcServer {
    pub fn new(path: PathBuf, shutdown_rx: tokio::sync::watch::Receiver<()>) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self { path, shutdown_rx, event_tx }
    }

    pub fn event_tx(&self) -> broadcast::Sender<IpcEvent> {
        self.event_tx.clone()
    }

    pub async fn run(self: Arc<Self>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Remove stale socket file.
        if self.path.exists() {
            std::fs::remove_file(&self.path)?;
        }

        // Ensure parent directory exists.
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let listener = UnixListener::bind(&self.path)?;

        loop {
            tokio::select! {
                _ = self.shutdown_rx.changed() => {
                    tracing::info!("IPC server shutting down");
                    break;
                }
                accept_result = listener.accept() => {
                    let (socket, _) = accept_result?;
                    let tx = self.event_tx.clone();
                    tokio::spawn(handle_client(socket, tx));
                }
            }
        }

        Ok(())
    }
}

async fn handle_client(
    socket: tokio::net::UnixStream,
    event_tx: broadcast::Sender<IpcEvent>,
) {
    let (reader, mut writer) = socket.into_split();
    let mut reader = BufReader::new(reader);
    let mut lines = reader.lines();

    let mut rx = event_tx.subscribe();

    loop {
        tokio::select! {
            line = lines.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        let request: serde_json::Value = match serde_json::from_str(&line) {
                            Ok(v) => v,
                            Err(_) => {
                                let resp = IpcResponse {
                                    id: None,
                                    result: None,
                                    error: Some(IpcError { code: -32700, message: "Parse error".into() }),
                                };
                                let _ = writer.write_all(serde_json::to_string(&resp).unwrap().as_bytes()).await;
                                let _ = writer.write_all(b"\n").await;
                                continue;
                            }
                        };
                        let id = request.get("id").cloned();
                        let response = process_request(request, &event_tx).await;
                        let resp_with_id = IpcResponse {
                            id,
                            result: response.0,
                            error: response.1,
                        };
                        let _ = writer.write_all(serde_json::to_string(&resp_with_id).unwrap().as_bytes()).await;
                        let _ = writer.write_all(b"\n").await;
                    }
                    Ok(None) => break, // EOF
                    Err(_) => break,
                }
            }
            event = rx.recv() => {
                // Forward events to client (one-way push).
                if let Ok(event) = event {
                    let msg = serde_json::to_string(&event).unwrap();
                    let _ = writer.write_all(msg.as_bytes()).await;
                    let _ = writer.write_all(b"\n").await;
                }
            }
        }
    }
}

type ResponseResult = (Option<serde_json::Value>, Option<IpcError>);

async fn process_request(
    req: serde_json::Value,
    _event_tx: &broadcast::Sender<IpcEvent>,
) -> ResponseResult {
    let method = match req.get("method").and_then(|m| m.as_str()) {
        Some(m) => m,
        None => return (None, Some(IpcError { code: -32600, message: "Invalid Request".into() })),
    };

    let params = req.get("params");

    match method {
        "get_scroll_enabled" => {
            // Read from app state. Access through a static for now.
            let enabled = IPC_STATE.load().scroll_enabled.load(std::sync::atomic::Ordering::Relaxed);
            (Some(serde_json::json!(enabled)), None)
        }
        "set_scroll_enabled" => {
            let enabled = params.and_then(|p| p.get("enabled")).and_then(|v| v.as_bool()).unwrap_or(false);
            IPC_STATE.load().scroll_enabled.store(enabled, std::sync::atomic::Ordering::Relaxed);
            (Some(serde_json::json!(true)), None)
        }
        "quit" => {
            // Signal app to quit.
            IPC_STATE.load().quit.store(true, std::sync::atomic::Ordering::Relaxed);
            (Some(serde_json::json!(true)), None)
        }
        _ => (None, Some(IpcError { code: -32601, message: format!("Method not found: {method}") })),
    }
}

// Global state accessible by the IPC server.
// In production, this would be replaced with proper state management.
static IPC_STATE: std::sync::LazyLock<Arc<IpcState>> =
    std::sync::LazyLock::new(|| Arc::new(IpcState::default()));

struct IpcState {
    scroll_enabled: std::sync::atomic::AtomicBool,
    direction_sync_enabled: std::sync::atomic::AtomicBool,
    quit: std::sync::atomic::AtomicBool,
}

impl Default for IpcState {
    fn default() -> Self {
        Self {
            scroll_enabled: std::sync::atomic::AtomicBool::new(true),
            direction_sync_enabled: std::sync::atomic::AtomicBool::new(false),
            quit: std::sync::atomic::AtomicBool::new(false),
        }
    }
}
```

**Note:** The `IPC_STATE` global is a simplified first pass. In the full implementation, the IPC server would take an `Arc<AppState>` reference and route to the actual engine state. See Task 7 for the integration.

- [ ] **Step 3: Integrate IPC server into lib.rs**

In `src-tauri/src/lib.rs`, after engine initialization, spawn the IPC server:

```rust
use crate::ipc_socket_server::IpcServer;
// ...
let ipc_path = directories
    .config_dir()
    .join("smoothscroll.sock");

let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());
let ipc_server = Arc::new(IpcServer::new(ipc_path, shutdown_rx));
let ipc_tx = ipc_server.event_tx();
let ipc_server_clone = ipc_server.clone();

tokio::spawn(async move {
    if let Err(e) = ipc_server_clone.run().await {
        tracing::error!("IPC server error: {}", e);
    }
});
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p smoothscroll-app --lib --target aarch64-apple-darwin`

Expected: FAIL — fix compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(macos): add IPC socket server for Swift communication"
```

---

## Task 7: Refine IPC Server State Integration with AppState

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`
- Modify: `src-tauri/src/state.rs`
- Test: `cargo check -p smoothscroll-app --lib`

- [ ] **Step 1: Replace the IPC_STATE global with AppState reference**

The IPC server needs to read/write the actual engine state. Update `ipc_socket_server.rs` to take an `Arc<AppState>`:

```rust
pub struct IpcServer {
    path: PathBuf,
    shutdown_rx: tokio::sync::watch::Receiver<()>,
    event_tx: broadcast::Sender<IpcEvent>,
    // Replace the static with a proper state reference.
    app_state: Arc<state::AppState>,  // <-- Add this
}
```

- [ ] **Step 2: Update process_request to use app_state**

In `process_request()`, replace the `IPC_STATE` access with calls through `app_state`:

```rust
async fn process_request(
    req: serde_json::Value,
    app_state: &Arc<state::AppState>,
) -> ResponseResult {
    match method {
        "get_scroll_enabled" => {
            let enabled = app_state.enabled.load(std::sync::atomic::Ordering::Relaxed);
            (Some(serde_json::json!(enabled)), None)
        }
        "set_scroll_enabled" => {
            let enabled = params.and_then(|p| p.get("enabled")).and_then(|v| v.as_bool()).unwrap_or(false);
            app_state.enabled.store(enabled, std::sync::atomic::Ordering::Relaxed);
            // Emit event to connected clients.
            let _ = app_state.event_tx.send(IpcEvent::ScrollStateChanged { enabled });
            (Some(serde_json::json!(true)), None)
        }
        // ... rest of methods
    }
}
```

**Note:** The exact `AppState` field names (`.enabled`, `.event_tx`) should be verified against `src-tauri/src/state.rs` before implementing. See the exploration results for the actual field layout.

- [ ] **Step 3: Add broadcast channel to AppState**

In `src-tauri/src/state.rs`, add an `event_tx` broadcast channel that the IPC server can emit through:

```rust
pub struct AppState {
    // ... existing fields ...
    pub event_tx: tokio::sync::broadcast::Sender<IpcEvent>,
}
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p smoothscroll-app --lib`

Expected: FAIL — fix compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs src-tauri/src/state.rs
git commit -m "refactor(macos): wire IPC server to AppState"
```

---

## Task 8: Create macOS Swift Project Scaffold

**Files:**
- Create: `macos/SmoothScrollMenuBar/project.yml`
- Create: `macos/SmoothScrollMenuBar/Sources/Resources/Info.plist`
- Create: `macos/SmoothScrollMenuBar/Sources/Resources/SmoothScrollMenuBar.entitlements`
- Test: `xcodegen generate` (requires XcodeGen installed on macOS)

- [ ] **Step 1: Create project.yml**

```yaml
name: SmoothScrollMenuBar
options:
  bundleIdPrefix: com.SmoothScroll
  deploymentTarget:
    macOS: "13.0"
  xcodeVersion: "15.0"
  generateEmptyDirectories: true

settings:
  base:
    PRODUCT_NAME: SmoothScrollMenuBar
    MARKETING_VERSION: "1.3.1"
    CURRENT_PROJECT_VERSION: "1"
    SWIFT_VERSION: "5.9"
    MACOSX_DEPLOYMENT_TARGET: "13.0"
    CODE_SIGN_IDENTITY: "-"
    CODE_SIGN_STYLE: Manual
    ENABLE_HARDENED_RUNTIME: YES
    INFOPLIST_FILE: Sources/Resources/Info.plist
    CODE_SIGN_ENTITLEMENTS: Sources/Resources/SmoothScrollMenuBar.entitlements
    COMBINE_HIDPI_IMAGES: YES
    ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
    LD_RUNPATH_SEARCH_PATHS:
      - "@executable_path/../Frameworks"

targets:
  SmoothScrollMenuBar:
    type: application
    platform: macOS
    sources:
      - path: Sources
        excludes:
          - "**/.DS_Store"
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.SmoothScroll.MenuBar
      GENERATE_INFOPLIST_FILE: NO
    entitlements:
      path: Sources/Resources/SmoothScrollMenuBar.entitlements
```

- [ ] **Step 2: Create Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIconFile</key>
    <string></string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>LSMinimumSystemVersion</key>
    <string>$(MACOSX_DEPLOYMENT_TARGET)</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 SmoothScroll. All rights reserved.</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSAppleEventsUsageDescription</key>
    <string>SmoothScroll needs accessibility access to intercept scroll events.</string>
</dict>
</plist>
```

- [ ] **Step 3: Create entitlements**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
</dict>
</plist>
```

- [ ] **Step 4: Verify XcodeGen can generate project**

Run: `xcodegen generate` (requires macOS with XcodeGen installed)

**On Windows/this environment:** Skip build verification. Review the project.yml for correctness manually.

- [ ] **Step 5: Commit**

```bash
git add macos/SmoothScrollMenuBar/project.yml macos/SmoothScrollMenuBar/Sources/Resources/
git commit -m "feat(macos): add XcodeGen project scaffold"
```

---

## Task 9: Implement Swift App Entry Point and AppDelegate

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/App/main.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift`

- [ ] **Step 1: Write main.swift**

```swift
import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
```

- [ ] **Step 2: Write AppDelegate.swift**

```swift
import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    private var menuBarController: MenuBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Prevent App Nap from throttling our scroll interception.
        ProcessInfo.processInfo.beginActivity(
            options: .userInitiated,
            reason: "SmoothScroll scroll event interception active"
        )

        // Initialize the menu bar.
        menuBarController = MenuBarController()
        menuBarController?.setup()

        // Connect to the Rust IPC socket.
        Task {
            do {
                try await IPCClient.shared.connect()
            } catch {
                print("Failed to connect to SmoothScroll engine: \(error)")
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        Task {
            try? await IPCClient.shared.disconnect()
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/App/main.swift macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift
git commit -m "feat(macos): add Swift app entry point and AppDelegate"
```

---

## Task 10: Implement MenuBarController (NSStatusItem + NSPopover)

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift`
- Test: Swift compile check

- [ ] **Step 1: Write MenuBarController.swift**

```swift
import AppKit
import SwiftUI

class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!

    func setup() {
        // Create the status bar item.
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            // Use a template image so it adapts to light/dark mode automatically.
            if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "SS"
            }
            button.action = #selector(togglePopover)
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        // Create the popover.
        popover = NSPopover()
        popover.contentSize = NSSize(width: 300, height: 340)
        popover.behavior = .transient          // Closes when clicking outside.
        popover.animates = true
        popover.contentViewController = NSHostingController(
            rootView: SmoothScrollPopover()
        )
    }

    @objc private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(
                relativeTo: sender.bounds,
                of: sender,
                preferredEdge: .minY
            )
            popover.contentViewController?.view.window?.makeKey()
        }
    }
}
```

- [ ] **Step 2: Verify Swift compilation**

On macOS: `swift build` or open in Xcode. On Windows: manual review only.

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift
git commit -m "feat(macos): implement MenuBarController with NSStatusItem and NSPopover"
```

---

## Task 11: Implement SwiftUI Popover Views

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollPopover.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollSection.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Views/DirectionSyncSection.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Views/PresetShortcutsView.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Views/SettingsRow.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Views/VisualEffectBlur.swift`

- [ ] **Step 1: Write VisualEffectBlur.swift (NSVisualEffectView wrapper)**

```swift
import SwiftUI
import AppKit

struct VisualEffectBlur: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}
```

- [ ] **Step 2: Write SettingsRow.swift (reusable toggle row)**

```swift
import SwiftUI

struct SettingsRow: View {
    let icon: String
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 8) {
                Text(icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.system(size: 12))
                    .foregroundColor(.primary)
            }
        }
        .toggleStyle(.switch)
        .controlSize(.small)
    }
}
```

- [ ] **Step 3: Write SmoothScrollSection.swift**

```swift
import SwiftUI

struct SmoothScrollSection: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("🌊")
                    .font(.system(size: 14))
                Text("Smooth Scroll")
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
            }

            SettingsRow(
                icon: "",
                title: "Enable",
                isOn: $settings.scrollEnabled
            )
            .onChange(of: settings.scrollEnabled) { _, newValue in
                Task {
                    try? await IPCClient.shared.setScrollEnabled(newValue)
                }
            }

            // Speed slider.
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(settings.speedLabel)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Slider(
                    value: $settings.speedValue,
                    in: 0...2,
                    step: 1
                ) {
                    Text("Speed")
                }
                .onChange(of: settings.speedValue) { _, _ in
                    Task {
                        try? await IPCClient.shared.setPreset(settings.speedPreset)
                    }
                }
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        .cornerRadius(8)
    }
}
```

- [ ] **Step 4: Write DirectionSyncSection.swift**

```swift
import SwiftUI

struct DirectionSyncSection: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("🔄")
                    .font(.system(size: 14))
                Text("Direction Sync")
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
            }

            SettingsRow(
                icon: "",
                title: "Sync Trackpad & Mouse",
                isOn: $settings.directionSyncEnabled
            )
            .onChange(of: settings.directionSyncEnabled) { _, newValue in
                Task {
                    try? await IPCClient.shared.setDirectionSyncEnabled(newValue)
                }
            }

            // Visual comparison.
            HStack(spacing: 8) {
                DeviceDirectionCard(
                    device: "💻",
                    label: "Trackpad",
                    direction: "Natural",
                    isActive: !settings.directionSyncEnabled
                )
                DeviceDirectionCard(
                    device: "🖱️",
                    label: "Mouse",
                    direction: settings.directionSyncEnabled ? "Synced" : "Reversed",
                    isActive: settings.directionSyncEnabled
                )
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        .cornerRadius(8)
    }
}

struct DeviceDirectionCard: View {
    let device: String
    let label: String
    let direction: String
    let isActive: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text(device)
                .font(.system(size: 18))
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
            Text(direction)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(isActive ? .accentColor : .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color(nsColor: .textBackgroundColor).opacity(0.5))
        .cornerRadius(6)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(isActive ? Color.accentColor : Color.clear, lineWidth: 1)
        )
    }
}
```

- [ ] **Step 5: Write PresetShortcutsView.swift**

```swift
import SwiftUI

struct PresetShortcutsView: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(spacing: 6) {
            // Preset buttons.
            HStack(spacing: 8) {
                PresetButton(label: "Balanced", shortcut: "⌘1", isActive: settings.speedPreset == "balanced") {
                    Task { try? await IPCClient.shared.setPreset("balanced") }
                }
                PresetButton(label: "Snappy", shortcut: "⌘2", isActive: settings.speedPreset == "snappy") {
                    Task { try? await IPCClient.shared.setPreset("snappy") }
                }
                PresetButton(label: "Glide", shortcut: "⌘3", isActive: settings.speedPreset == "glide") {
                    Task { try? await IPCClient.shared.setPreset("glide") }
                }
            }

            Divider()

            // Action shortcuts.
            HStack {
                ActionShortcut(label: "⌘D DirSync", action: "Toggle") {
                    settings.directionSyncEnabled.toggle()
                    Task { try? await IPCClient.shared.setDirectionSyncEnabled(settings.directionSyncEnabled) }
                }
                Spacer()
                ActionShortcut(label: "⌘, Prefs", action: "System Settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                        NSWorkspace.shared.open(url)
                    }
                }
                Spacer()
                Button("⌘Q Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)
                .font(.system(size: 11))
            }
        }
    }
}

struct PresetButton: View {
    let label: String
    let shortcut: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(shortcut)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(4)
                Text(label)
                    .font(.system(size: 11))
            }
            .foregroundColor(isActive ? .accentColor : .primary)
        }
        .buttonStyle(.plain)
    }
}

struct ActionShortcut: View {
    let label: String
    let action: String
    let callback: () -> Void

    var body: some View {
        Button(action: callback) {
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
        .buttonStyle(.plain)
    }
}
```

- [ ] **Step 6: Write SmoothScrollPopover.swift (main view)**

```swift
import SwiftUI

struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore()

    var body: some View {
        VStack(spacing: 0) {
            // Header.
            PopoverHeader()

            Divider()

            // Section 1: Smooth Scroll.
            SmoothScrollSection(settings: settings)
                .padding(.horizontal, 12)
                .padding(.top, 12)

            // Section 2: Direction Sync.
            DirectionSyncSection(settings: settings)
                .padding(.horizontal, 12)
                .padding(.top, 8)

            Divider()
                .padding(.top, 8)

            // Footer shortcuts.
            PresetShortcutsView(settings: settings)
                .padding(12)
        }
        .frame(width: 300)
        .background(
            VisualEffectBlur(material: .popover, blendingMode: .behindWindow)
                .ignoresSafeArea()
        )
    }
}

struct PopoverHeader: View {
    var body: some View {
        HStack(spacing: 8) {
            Text("🐭")
                .font(.system(size: 16))
            VStack(alignment: .leading, spacing: 0) {
                Text("SmoothScroll")
                    .font(.system(size: 13, weight: .semibold))
                Text("v1.3.1")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            Spacer()
            Circle()
                .fill(Color.green)
                .frame(width: 8, height: 8)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Views/
git commit -m "feat(macos): implement SwiftUI popover views"
```

---

## Task 12: Implement IPC Client and Settings Store

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift`
- Create: `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`

- [ ] **Step 1: Write IPCProtocol.swift**

```swift
import Foundation

// MARK: - Requests (Swift → Rust)

enum IpcRequest: Codable {
    case getScrollEnabled
    case setScrollEnabled(enabled: Bool)
    case getDirectionSyncEnabled
    case setDirectionSyncEnabled(enabled: Bool)
    case getPreset
    case setPreset(preset: String)
    case getSettings
    case saveSettings(settings: [String: AnyCodable])
    case quit
}

struct IpcRequestMessage: Codable {
    let jsonrpc: String = "2.0"
    let id: Int?
    let method: String
    let params: [String: AnyCodable]?
}

// MARK: - Responses

struct IpcResponse: Codable {
    let jsonrpc: String
    let id: Int?
    let result: AnyCodable?
    let error: IpcError?
}

struct IpcError: Codable {
    let code: Int
    let message: String
}

// MARK: - Events (Rust → Swift)

enum IpcEvent: Codable {
    case scrollStateChanged(enabled: Bool)
    case directionSyncChanged(enabled: Bool)
    case presetChanged(preset: String)
}

// MARK: - AnyCodable helper

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let bool = value as? Bool {
            try container.encode(bool)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let string = value as? String {
            try container.encode(string)
        } else {
            try container.encodeNil()
        }
    }
}
```

- [ ] **Step 2: Write IPCClient.swift**

```swift
import Foundation

actor IPCClient {
    static let shared = IPCClient()

    private var socket: UnixSocketConnection?
    private var isConnected = false
    private var nextId = 1

    private let socketPath: String

    private init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.socketPath = "\(home)/.smoothscroll/socket"
    }

    func connect() async throws {
        guard !isConnected else { return }

        let connection = UnixSocketConnection(path: socketPath)
        try await connection.connect()
        self.socket = connection
        self.isConnected = true

        // Start reading responses and events.
        Task {
            await readLoop()
        }
    }

    func disconnect() async throws {
        isConnected = false
        socket = nil
    }

    private func readLoop() async {
        guard let socket = socket else { return }

        while isConnected {
            do {
                let line = try await socket.readLine()
                guard let data = line.data(using: .utf8) else { continue }

                // Try to decode as event first.
                if let event = try? JSONDecoder().decode(IpcEvent.self, from: data) {
                    await handleEvent(event)
                }
            } catch {
                isConnected = false
                break
            }
        }
    }

    private func handleEvent(_ event: IpcEvent) async {
        await MainActor.run {
            switch event {
            case .scrollStateChanged(let enabled):
                SettingsStore.shared.scrollEnabled = enabled
            case .directionSyncChanged(let enabled):
                SettingsStore.shared.directionSyncEnabled = enabled
            case .presetChanged(let preset):
                SettingsStore.shared.speedPreset = preset
            }
        }
    }

    private func send<T: Decodable>(_ request: IpcRequest) async throws -> T {
        guard let socket = socket else {
            throw IpcError(message: "Not connected")
        }

        let id = nextId
        nextId += 1

        let (method, params) = requestToMethodAndParams(request)
        let message = IpcRequestMessage(id: id, method: method, params: params)
        let data = try JSONEncoder().encode(message)
        let line = String(data: data, encoding: .utf8)! + "\n"

        try await socket.write(line)

        // For simplicity, events are handled in the read loop.
        // This is a simplified client — a full implementation would use
        // a dictionary of pending requests keyed by id.
        throw IpcError(message: "Request/response not implemented — use events for state sync")
    }

    private func requestToMethodAndParams(_ request: IpcRequest) -> (String, [String: AnyCodable]?) {
        switch request {
        case .getScrollEnabled:
            return ("get_scroll_enabled", nil)
        case .setScrollEnabled(let enabled):
            return ("set_scroll_enabled", ["enabled": AnyCodable(enabled)])
        case .getDirectionSyncEnabled:
            return ("get_direction_sync_enabled", nil)
        case .setDirectionSyncEnabled(let enabled):
            return ("set_direction_sync_enabled", ["enabled": AnyCodable(enabled)])
        case .getPreset:
            return ("get_preset", nil)
        case .setPreset(let preset):
            return ("set_preset", ["preset": AnyCodable(preset)])
        case .quit:
            return ("quit", nil)
        default:
            return ("unknown", nil)
        }
    }

    // MARK: - Convenience Methods

    func setScrollEnabled(_ enabled: Bool) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_scroll_enabled\",\"params\":{\"enabled\":\(enabled)}}\n")
        nextId += 1
    }

    func setDirectionSyncEnabled(_ enabled: Bool) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_direction_sync_enabled\",\"params\":{\"enabled\":\(enabled)}}\n")
        nextId += 1
    }

    func setPreset(_ preset: String) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_preset\",\"params\":{\"preset\":\"\(preset)\"}}\n")
        nextId += 1
    }
}

// MARK: - Unix Socket Connection

class UnixSocketConnection {
    let path: String
    private var stream: FileHandle?

    init(path: String) {
        self.path = path
    }

    func connect() async throws {
        // Use a pipe approach: connect to the Unix socket.
        let url = URL(fileURLWithPath: path)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var readHandle: FileHandle?
            var writeHandle: FileHandle?

            // On macOS, use CFSocket/URLSession for Unix domain sockets.
            // For simplicity, we use a Task to handle the connection.
            Task {
                do {
                    let (r, w) = try await Darwin.connectToUnixSocket(path: self.path)
                    self.stream = r
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func write(_ data: String) async throws {
        guard let stream = stream else { throw IpcError(message: "Not connected") }
        try await stream.write(contentsOf: data.data(using: .utf8)!)
    }

    func readLine() async throws -> String {
        guard let stream = stream else { throw IpcError(message: "Not connected") }
        return try await stream.readLine()
    }
}

struct IpcError: Error {
    let message: String
}
```

**Note:** `Darwin.connectToUnixSocket` is not a standard API. The actual implementation should use `CFStream` with `kCFStreamPropertySocketNativeHandle` or a third-party socket library like `NIOCore`. For the first pass, use `NWConnection` from Network.framework:

```swift
import Network

extension UnixSocketConnection {
    func connect() async throws {
        let endpoint = NWEndpoint.unix(path: self.path)
        let connection = NWConnection(to: endpoint, using: .tcp)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    continuation.resume()
                case .failed(let error):
                    continuation.resume(throwing: error)
                default:
                    break
                }
            }
            connection.start(queue: .global())
        }
    }
}
```

- [ ] **Step 3: Write SettingsStore.swift**

```swift
import Foundation
import Combine

@MainActor
class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    @Published var scrollEnabled: Bool = true {
        didSet { objectWillChange.send() }
    }
    @Published var directionSyncEnabled: Bool = false {
        didSet { objectWillChange.send() }
    }
    @Published var speedPreset: String = "balanced" {
        didSet { objectWillChange.send() }
    }
    @Published var speedValue: Double = 1 {
        didSet { objectWillChange.send() }
    }

    var speedLabel: String {
        switch speedPreset {
        case "snappy": return "Snappy"
        case "glide": return "Glide"
        default: return "Balanced"
        }
    }

    private init() {}
}
```

- [ ] **Step 4: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/ macos/SmoothScrollMenuBar/Sources/Settings/
git commit -m "feat(macos): implement IPC client and settings store"
```

---

## Task 13: Enable and Update macOS CI Job

**Files:**
- Modify: `.github/workflows/auto-release.yml`

- [ ] **Step 1: Replace the commented build-macos job with the updated version**

Replace the commented-out `build-macos` section in `.github/workflows/auto-release.yml` with:

```yaml
  build-macos:
    needs: bump
    if: needs.bump.outputs.skipped != 'true'
    continue-on-error: true
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: aarch64-apple-darwin
            arch: arm64
          - target: x86_64-apple-darwin
            arch: x64
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.bump.outputs.tag }}

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache cargo + target
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: |
            .
          shared-key: build-macos-${{ matrix.target }}

      - name: Build Rust engine
        run: |
          cargo build --release -p smoothscroll-platform -p smoothscroll-core --target ${{ matrix.target }}

      - name: Build Swift app
        run: |
          brew install xcodegen
          cd macos/SmoothScrollMenuBar
          xcodegen generate
          xcodebuild -project SmoothScrollMenuBar.xcodeproj -scheme SmoothScrollMenuBar -configuration Release -arch ${{ matrix.arch }} build

      - name: Package DMG
        run: |
          mkdir -p dmg-tmp
          # Copy app bundle into DMG staging area.
          APP_PATH="macos/SmoothScrollMenuBar/build/Release/SmoothScrollMenuBar.app"
          # Use create-dmg or hdiutil to create the DMG.
          hdiutil create dmg-tmp/SmoothScroll.dmg -volname SmoothScroll -srcfolder "$APP_PATH" -ov
          DMG_PATH="dmg-tmp/SmoothScroll_${{ matrix.arch }}.dmg"
          mv dmg-tmp/SmoothScroll.dmg "$DMG_PATH"
          echo "dmg_path=$DMG_PATH" >> "$GITHUB_OUTPUT"

      - name: Upload .dmg to Release
        if: matrix.arch == 'arm64'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.bump.outputs.tag }}
          generate_release_notes: true
          files: |
            dmg-tmp/*.dmg
```

- [ ] **Step 2: Update cleanup-releases to depend on build-macos too**

Find the `cleanup-releases` job and update its `needs` from `[bump, build-windows]` to `[bump, build-windows, build-macos]`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/auto-release.yml
git commit -m "ci(macos): enable build-macos job for DMG generation"
```

---

## Task 14: Final Integration Verification

**Files:**
- All modified files

- [ ] **Step 1: Run full compile check for all modified crates**

```bash
# Check Rust crates compile for macOS target
cargo check --workspace --target aarch64-apple-darwin --lib

# Check Rust crates compile for Windows (regression)
cargo check --workspace --lib
```

- [ ] **Step 2: Verify no dead code or unused imports in modified files**

Run linter if available.

- [ ] **Step 3: Verify SPEC coverage**

Review `docs/SPEC-macos.md` section by section:

| Spec Section | Implementation |
|---|---|
| Menu Bar Extra (NSStatusItem) | Task 10 |
| NSPopover with SwiftUI | Task 10 |
| Smooth Scroll section | Task 11 |
| Direction Sync section | Task 11 |
| Keyboard shortcuts footer | Task 11 |
| CGEventTap scroll interception | Task 2 |
| Wheel emitter | Task 3 |
| Accessibility permission | Task 4 |
| Global hotkeys | Existing hotkey.rs |
| Autostart (LaunchAgent) | Existing autostart.rs |
| IPC socket server | Tasks 6-7 |
| Swift ↔ Rust IPC | Tasks 12 |
| Settings persistence | Uses shared JSON file |
| Dark/Light mode vibrancy | Task 11 (VisualEffectBlur) |
| LSUIElement (no Dock icon) | Task 8 (Info.plist) |
| macOS CI job | Task 13 |

- [ ] **Step 4: Mark all tasks complete and commit**

---

## Phase Summary

| Task | Description | Est. Lines |
|---|---|---|
| 1 | Add macOS Rust dependencies | ~10 |
| 2 | CGEventTap scroll interception | ~120 |
| 3 | Wheel emitter (CGEvent emission) | ~60 |
| 4 | is_trusted() accessibility check | ~30 |
| 5 | Wire macOS platform bundle | ~20 |
| 6 | IPC socket server (basic) | ~200 |
| 7 | IPC server state integration | ~80 |
| 8 | XcodeGen project scaffold | ~60 |
| 9 | Swift main.swift + AppDelegate | ~30 |
| 10 | MenuBarController | ~50 |
| 11 | SwiftUI popover views (6 files) | ~350 |
| 12 | IPC client + settings store | ~200 |
| 13 | CI/CD (build-macos job) | ~50 |
| 14 | Integration verification | — |

**Total: ~1,260 lines of new code** across Rust + Swift + YAML.
