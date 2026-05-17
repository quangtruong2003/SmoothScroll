//! Shared types used across all platform impls.

/// Modifier-key state captured at the moment of a hook event.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ModifierKeys {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
}

/// Tells the hook whether to forward the original event or eat it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookDecision {
    /// Pass the event to the next hook / system. Default behaviour.
    Pass,
    /// Stop the event from reaching apps. Use after we re-emit our own pulses.
    Swallow,
}

/// Cross-platform hotkey accelerator. Mirrors Tauri's accelerator string
/// roughly: "CommandOrControl+Alt+S".
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Accelerator {
    pub raw: String,
}

#[derive(Debug, thiserror::Error)]
pub enum PlatformError {
    #[error("OS error: {0}")]
    Os(String),
    #[error("permission denied (e.g., Accessibility on macOS)")]
    PermissionDenied,
    #[error("not supported on this platform")]
    Unsupported,
}

pub type Result<T> = std::result::Result<T, PlatformError>;

#[derive(Debug, Clone, Copy)]
pub struct KeyboardKeyEvent {
    pub key: smoothscroll_core::keyboard_scroll::KeyboardScrollKey,
    pub is_autorepeat: bool,
}
