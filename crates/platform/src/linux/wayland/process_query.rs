//! Process query for Wayland using compositor-specific APIs.
//!
//! Primary: /proc/<pid>/comm for basic process info
//! Fallback: KDE KWin or GNOME Shell APIs for foreground window

use crate::traits::{ProcessInfo, ProcessQuery};

pub struct WaylandProcessQuery;

impl WaylandProcessQuery {
    pub fn new() -> Self {
        Self
    }
}

/// Get foreground window PID via KWin (KDE Plasma).
fn kwin_foreground_pid() -> Option<u32> {
    let output = std::process::Command::new("qdbus")
        .args(["org.kde.KWin", "/KWin", "org.kde.KWin.activeWindow"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let window_id = String::from_utf8_lossy(&output.stdout);
    let window_id = window_id.trim();

    if window_id.is_empty() || window_id == "0" {
        return None;
    }

    // KWin returns window ID as decimal string
    window_id.parse().ok()
}

/// Get process name from /proc/<pid>/comm
fn process_name_from_pid(pid: u32) -> Option<String> {
    use std::fs;

    // Try comm first (process name)
    if let Ok(name) = fs::read_to_string(format!("/proc/{pid}/comm")) {
        let name = name.trim().to_string();
        if !name.is_empty() {
            return Some(name);
        }
    }

    // Fall back to exe symlink
    if let Ok(exe) = fs::read_link(format!("/proc/{pid}/exe")) {
        if let Some(name) = exe.file_name() {
            let name = name.to_string_lossy().into_owned();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    None
}

impl ProcessQuery for WaylandProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        // ## Future Implementation Criteria
        // - Query compositor for window under cursor coordinates and resolve its pid:
        //   - KDE: D-Bus org.kde.KWin for window at position
        //   - GNOME: org.gnome.Shell introspection for window under pointer
        //   - wlroots: wlr-foreign-toplevel-management for window geometry
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();

        if desktop.contains("kde") || desktop.contains("plasma") {
            kwin_foreground_pid()
        } else {
            // GNOME doesn't expose foreground window PID via simple command
            // Could try GNOME Shell extension API but that's complex
            None
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        use std::fs;

        let mut results = Vec::new();

        if let Ok(entries) = fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(s) => s,
                    None => continue,
                };

                // PID must be numeric
                let pid: u32 = match name.parse() {
                    Ok(p) => p,
                    Err(_) => continue,
                };

                // Skip kernel threads (PIDs < 100) and self
                if pid < 100 || pid == std::process::id() {
                    continue;
                }

                // Try to get process name
                if let Some(proc_name) = process_name_from_pid(pid) {
                    let exe_path = fs::read_link(format!("/proc/{pid}/exe"))
                        .ok()
                        .and_then(|p| p.to_str().map(String::from));

                    results.push(ProcessInfo {
                        pid,
                        name: proc_name,
                        window_title: String::new(),
                        exe_path,
                    });
                }
            }
        }

        results
    }

    fn foreground_process_name(&self) -> Option<String> {
        let pid = self.foreground_process_id()?;
        process_name_from_pid(pid)
    }

    fn is_target_elevated(&self) -> bool {
        // Linux doesn't have UAC-like elevation
        unsafe { nix::libc::geteuid() == 0 }
    }
}
