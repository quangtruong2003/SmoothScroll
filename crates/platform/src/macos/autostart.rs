//! macOS autostart via LaunchAgent plist at
//! `~/Library/LaunchAgents/com.smoothscroll.app.plist`.
//!
//! Polished:
//! - Uses `gui/<uid>` domain so the agent runs in the user GUI session
//!   (matches what launchctl shows when a user clicks "Open at Login"
//!   in System Settings → General → Login Items). Without this,
//!   `launchctl load` falls into the legacy `system` domain on
//!   older macOS, which doesn't appear in System Settings and can
//!   break if the user revokes it through that UI.
//! - Includes a `StandardOutPath`/`StandardErrorPath` to
//!   `~/Library/Logs/SmoothScroll/` so launch failures surface in
//!   Console.app instead of being silently swallowed.
//! - Properly handles paths with spaces, `&`, `<`, `>`.
//! - Sets `ProcessType=Interactive` so the app can present UI when
//!   the user opens settings; we don't want to be marked as a
//!   background-only agent because the tray menu + settings window
//!   need to focus.

#![cfg(target_os = "macos")]

use crate::traits::Autostart;
use crate::types::{PlatformError, Result};
use std::path::PathBuf;

const LABEL: &str = "com.smoothscroll.app";

pub struct MacosAutostart;

impl Autostart for MacosAutostart {
    fn is_enabled(&self) -> bool {
        plist_path().map(|p| p.exists()).unwrap_or(false)
    }

    fn set(&self, enabled: bool) -> Result<()> {
        let path = plist_path().ok_or_else(|| PlatformError::Os("no $HOME".into()))?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| PlatformError::Os(format!("mkdir LaunchAgents: {e}")))?;
        }

        if enabled {
            let exe = std::env::current_exe()
                .map_err(|e| PlatformError::Os(format!("current_exe: {e}")))?;
            // Make sure log directory exists so launchd doesn't fail when
            // it tries to open the log file. If the dir can't be created
            // (sandboxed), we still write the plist — launchd will simply
            // skip the redirect and log to its own store.
            let log_dir = log_dir();
            if let Some(dir) = log_dir.as_ref() {
                let _ = std::fs::create_dir_all(dir);
            }
            let plist = build_plist(&exe, log_dir.as_deref());
            std::fs::write(&path, plist)
                .map_err(|e| PlatformError::Os(format!("write plist: {e}")))?;
            // bootstrap into gui/<uid> so it shows up in System Settings.
            // `launchctl load -w` is the legacy command but still works
            // for back-compat; on macOS 13+ prefer `bootstrap` which
            // doesn't deactivate existing instances and is non-blocking.
            let gui_target = format!("gui/{}", get_uid());
            let _ = std::process::Command::new("launchctl")
                .arg("bootstrap")
                .arg(&gui_target)
                .arg(&path)
                .status();
            // Fall back to `load` if bootstrap isn't supported (macOS 10.10
            // and older). `-w` writes the disabled flag back to the plist
            // so future loads keep the user's preference.
            let _ = std::process::Command::new("launchctl")
                .arg("load")
                .arg("-w")
                .arg(&path)
                .status();
        } else if path.exists() {
            // Try modern `bootout` first, fall back to legacy `unload`.
            let gui_target = format!("gui/{}", get_uid());
            let _ = std::process::Command::new("launchctl")
                .arg("bootout")
                .arg(&gui_target)
                .arg(&path)
                .status();
            let _ = std::process::Command::new("launchctl")
                .arg("unload")
                .arg("-w")
                .arg(&path)
                .status();
            std::fs::remove_file(&path)
                .map_err(|e| PlatformError::Os(format!("remove plist: {e}")))?;
        }
        Ok(())
    }
}

fn plist_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join("Library/LaunchAgents")
            .join(format!("{LABEL}.plist")),
    )
}

fn log_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(PathBuf::from(home).join("Library/Logs/SmoothScroll"))
}

/// Returns the current effective user id as a decimal string. `getuid()` is
/// always available on macOS so we call libc directly instead of shelling
/// out to `id -u`.
fn get_uid() -> String {
    // SAFETY: getuid is async-signal-safe and has no preconditions.
    let uid = unsafe { libc::getuid() };
    uid.to_string()
}

/// Escape a string for embedding inside an XML plist text node. We use a
/// single `&string` interpolation so we need to escape `&`, `<`, and `>`
/// (the latter only appears as `>` but Apple-style plist editors also
/// escape `>` so we do it for symmetry).
fn xml_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            _ => out.push(ch),
        }
    }
    out
}

fn build_plist(exe: &std::path::Path, log_dir: Option<&std::path::Path>) -> String {
    let exe_str = xml_escape(&exe.display().to_string());
    let log_out = log_dir
        .map(|d| xml_escape(&d.join("stdout.log").display().to_string()))
        .unwrap_or_else(|| "/dev/null".to_string());
    let log_err = log_dir
        .map(|d| xml_escape(&d.join("stderr.log").display().to_string()))
        .unwrap_or_else(|| "/dev/null".to_string());

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{exe_str}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProcessType</key>
    <string>Interactive</string>
    <key>StandardOutPath</key>
    <string>{log_out}</string>
    <key>StandardErrorPath</key>
    <string>{log_err}</string>
</dict>
</plist>
"#
    )
}
