//! Shared types used across all platform impls.

/// Modifier-key state captured at the moment of a hook event.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ModifierKeys {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    /// macOS-only: the Command key. Always `false` on Windows. Hot-path
    /// branches that read this MUST be `#[cfg(target_os = "macos")]` so
    /// Windows doesn't read a never-set field.
    pub cmd: bool,
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

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct WindowRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}
