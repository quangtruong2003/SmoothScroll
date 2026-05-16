//! macOS stub. Real implementation will land when macOS support ships.

#![cfg(target_os = "macos")]

/// Returns true if Accessibility is granted. Stub always returns false.
pub fn is_trusted(_prompt: bool) -> bool {
    false
}
