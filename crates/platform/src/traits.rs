//! Trait definitions for OS-specific subsystems. Implementations live in
//! `windows/` and `macos/` modules (cfg-gated).

use crate::types::{
    Accelerator, HookDecision, KeyboardKeyEvent, ModifierKeys, Point, Result, WindowRect,
};
use std::sync::Arc;

/// Receives parsed hook events. Implementation lives in the app crate.
pub trait HookEventSink: Send + Sync {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision;
    fn on_hwheel(&self, delta: i32) -> HookDecision;

    fn on_wheel_ext(
        &self,
        delta: i32,
        mods: ModifierKeys,
        _source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.on_wheel(delta, mods)
    }
    fn on_hwheel_ext(
        &self,
        delta: i32,
        _source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.on_hwheel(delta)
    }
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

/// Emits synthetic wheel events. Pre-multiplied integer pulses
/// (use `core::constants::EMIT_UNIT`).
pub trait WheelEmitter: Send + Sync {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()>;
}

/// Returned by `list_visible_processes`. Used by the UI picker.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub window_title: String,
}

pub trait ProcessQuery: Send + Sync {
    fn process_name_under_cursor(&self) -> Option<String>;
    fn foreground_process_id(&self) -> Option<u32>;
    fn list_visible_processes(&self) -> Vec<ProcessInfo>;
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
}

pub trait KeyboardScrollSink: Send + Sync {
    fn on_key(&self, ev: KeyboardKeyEvent) -> HookDecision;
}

pub trait KeyboardScrollHook: Send + Sync {
    fn install(&self, sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle>;
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
