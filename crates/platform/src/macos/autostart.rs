//! macOS autostart via LaunchAgent plist at
//! `~/Library/LaunchAgents/com.smoothscroll.app.plist`.

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
            let plist = build_plist(&exe);
            std::fs::write(&path, plist)
                .map_err(|e| PlatformError::Os(format!("write plist: {e}")))?;
            // load it; ignore error if already loaded
            let _ = std::process::Command::new("launchctl")
                .arg("load")
                .arg("-w")
                .arg(&path)
                .status();
        } else if path.exists() {
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

fn build_plist(exe: &std::path::Path) -> String {
    let escaped = exe
        .display()
        .to_string()
        .replace('&', "&amp;")
        .replace('<', "&lt;");
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{escaped}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
"#
    )
}
