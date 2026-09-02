//! Trait definitions for OS-specific subsystems. Implementations live in
//! `windows/` and `macos/` modules (cfg-gated).

use crate::types::{
    Accelerator, HookDecision, Point, Result, SemanticPulse, WheelInputEvent, WheelSequence,
    WindowRect,
};
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

/// Receives parsed wheel events with their complete semantic identity.
pub trait HookEventSink: Send + Sync {
    fn on_wheel_event(&self, event: WheelInputEvent) -> HookDecision;
}

/// Opaque RAII handle. Dropping uninstalls the hook.
pub struct HookHandle {
    pub(crate) _inner: Box<dyn std::any::Any + Send + Sync>,
}

impl HookHandle {
    pub fn new(inner: Box<dyn std::any::Any + Send + Sync>) -> Self {
        Self { _inner: inner }
    }
}

pub trait MouseHook: Send + Sync {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle>;
}

/// Captured identity of the animation that produced a semantic pulse, used to
/// invalidate queued compatibility work after semantic/root/raw transitions.
///
/// The generation token is backed by the caller's shared `Arc<AtomicU64>` so
/// the routing layer and the platform worker validate against the exact same
/// counter the pulse was planned under.
#[derive(Debug, Clone)]
pub struct EmissionContext {
    pub root_owner: Option<isize>,
    pub axis_generation: u64,
    pub generation: Arc<AtomicU64>,
}

impl EmissionContext {
    /// True when the axis generation is still current at validation time.
    pub fn is_current(&self) -> bool {
        self.generation.load(std::sync::atomic::Ordering::Acquire) == self.axis_generation
    }
}

/// Emits wheel pulses that preserve the captured semantic identity.
pub trait SemanticWheelEmitter: Send + Sync {
    /// Validate that the emitter can reproduce `sequence` before the hook
    /// swallows the originating physical event. Performs no injection.
    fn prepare(&self, sequence: WheelSequence) -> Result<()>;

    fn emit_semantic(&self, pulse: SemanticPulse, context: EmissionContext) -> Result<()>;
}

/// Returned by `list_visible_processes`. Used by the UI picker.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub window_title: String,
    /// Absolute path to the executable on disk, when available.
    /// `None` on platforms that cannot resolve it cheaply or when the
    /// process is not accessible (e.g. protected by AppContainer / SIP).
    pub exe_path: Option<String>,
}

pub trait ProcessQuery: Send + Sync {
    fn process_name_under_cursor(&self) -> Option<String>;
    fn foreground_process_id(&self) -> Option<u32>;
    fn list_visible_processes(&self) -> Vec<ProcessInfo>;

    /// Process name (file stem of executable on Windows, or localized app
    /// name on macOS) of the current foreground window. Returns None when
    /// there is no foreground window or the query fails. Default returns
    /// None; Win/Mac implementations override with platform-specific logic.
    fn foreground_process_name(&self) -> Option<String> {
        None
    }

    /// Combined foreground query: returns both process name and exe path
    /// in a single call, avoiding two separate platform lookups. Default
    /// returns None; per-platform impls override for efficiency.
    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        None
    }

    /// Returns true if the window under the cursor belongs to a process
    /// running at High (elevated) integrity level. Used to bypass smooth
    /// scrolling for admin apps that UIPI would otherwise block.
    ///
    /// The default returns `false` (safe — bypass is skipped on macOS and
    /// on non-Windows builds). Windows overrides this in
    /// `WindowsProcessQuery`.
    fn is_target_elevated(&self) -> bool {
        false
    }

    /// Returns true if the SmoothScroll process itself runs at High
    /// (elevated) integrity level. When SmoothScroll is elevated too, UIPI
    /// permits synthetic input into elevated targets, so `is_target_elevated`
    /// alone must not cause a bypass.
    ///
    /// The default returns `false` (safe — bypass behaviour is unchanged on
    /// non-Windows platforms). Windows overrides this in
    /// `WindowsProcessQuery`.
    fn self_is_elevated(&self) -> bool {
        false
    }
}

pub trait Autostart: Send + Sync {
    fn is_enabled(&self) -> bool;
    fn set(&self, enabled: bool) -> Result<()>;
}

pub struct HotkeyHandle {
    pub(crate) _inner: Box<dyn std::any::Any + Send + Sync>,
}

impl HotkeyHandle {
    pub fn new(inner: Box<dyn std::any::Any + Send + Sync>) -> Self {
        Self { _inner: inner }
    }
}

pub trait Hotkey: Send + Sync {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle>;
}

pub trait FullscreenDetector: Send + Sync {
    fn is_foreground_fullscreen(&self) -> bool;
}

pub trait WindowGeometry: Send + Sync {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)>;

    fn root_window_under_cursor(&self) -> Option<isize> {
        None
    }

    fn monitor_for_hwnd(&self, _hwnd: isize) -> Option<String> {
        None // default — platforms override
    }

    /// Returns true when the cursor sits over a control that consumes wheel
    /// input in whole-notch steps (spinbox, slider, combo box, list). The
    /// engine's sub-notch pulse train mis-steps such controls, so the hook
    /// passes the raw wheel event through instead of swallowing it.
    ///
    /// Default `false` keeps existing behaviour on platforms without
    /// class-level hit testing.
    fn cursor_over_discrete_control(&self) -> bool {
        false
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MonitorInfo {
    pub device_name: String,
    pub friendly_name: String,
    pub rect: crate::types::WindowRect,
}

pub trait MonitorEnumeration: Send + Sync {
    fn list_monitors(&self) -> Vec<MonitorInfo>;
}

/// OS-level accessibility signals that influence engine behaviour.
pub trait AccessibilitySignals: Send + Sync {
    /// Returns true when the OS reports "Reduce Motion" / "Disable animations".
    fn reduce_motion_enabled(&self) -> bool;

    /// Subscribe to changes. The callback is invoked on a platform-owned
    /// thread whenever the OS toggles the signal. Dropping the returned handle
    /// stops the subscription.
    fn watch(&self, on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle>;
}

/// Returns the primary monitor's current refresh rate in Hz.
/// Returns 60 if detection fails (safe fallback).
pub trait DisplayQuery: Send + Sync {
    fn primary_refresh_rate_hz(&self) -> u32;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct StubWindowGeometry;

    impl WindowGeometry for StubWindowGeometry {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }
    }

    #[test]
    fn window_geometry_default_has_no_root_window() {
        assert_eq!(StubWindowGeometry.root_window_under_cursor(), None);
    }
}
