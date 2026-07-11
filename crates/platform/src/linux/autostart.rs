//! XDG autostart via ~/.config/autostart/smoothscroll.desktop.
//!
//! Polished:
//! - Uses `$XDG_CONFIG_HOME` when set, falls back to `$HOME/.config`
//!   per the XDG Base Directory Specification.
//! - Includes all the standard XDG/Desktop Entry keys expected by
//!   GNOME Tweaks, KDE System Settings, and Elementary Pantheon:
//!   `Type`, `Version`, `Name`, `GenericName`, `Comment`, `Categories`,
//!   `Terminal`, `StartupNotify`, `Icon`, `Exec`.
//! - `X-GNOME-Autostart-enabled=true` so GNOME's "Startup Applications"
//!   pref tool lists the entry as enabled (otherwise the toggle in
//!   that UI is blank).
//! - Uses `Hidden=false` so we always surface in `systemd --user` unit
//!   lists and GNOME's "Background Apps" view.
//! - Properly quotes the `Exec=` path so paths with spaces work.
//! - Sets `TryExec` so desktop environments skip the entry if the
//!   binary has been removed from disk.

use crate::traits::Autostart;
use crate::types::{PlatformError, Result};
use std::fs;
use std::path::PathBuf;

const APP_ID: &str = "smoothscroll";
const APP_NAME: &str = "SmoothScroll";
const APP_COMMENT: &str = "Smooth scrolling for every application";
const APP_GENERIC: &str = "Mouse utility";

pub struct LinuxAutostart;

impl LinuxAutostart {
    fn desktop_path() -> Result<PathBuf> {
        let config_home = std::env::var("XDG_CONFIG_HOME")
            .ok()
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".config"))
            })
            .ok_or_else(|| PlatformError::Os("XDG_CONFIG_HOME/HOME not set".into()))?;
        Ok(config_home
            .join("autostart")
            .join(format!("{APP_ID}.desktop")))
    }

    fn exec_path() -> Result<String> {
        let exe =
            std::env::current_exe().map_err(|e| PlatformError::Os(format!("current_exe: {e}")))?;
        // Desktop entry spec: spaces and quotes in Exec must be escaped.
        // We don't pass any user args so a simple quoted path is enough.
        let s = exe.to_string_lossy();
        let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
        Ok(format!("\"{escaped}\""))
    }
}

impl Autostart for LinuxAutostart {
    fn is_enabled(&self) -> bool {
        Self::desktop_path().map(|p| p.exists()).unwrap_or(false)
    }

    fn set(&self, enabled: bool) -> Result<()> {
        let path = Self::desktop_path()?;
        if enabled {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| PlatformError::Os(format!("mkdir autostart: {e}")))?;
            }
            let exec = Self::exec_path()?;
            // TryExec should be the unquoted path so DEs can check liveness.
            let exe_raw = std::env::current_exe()
                .map_err(|e| PlatformError::Os(format!("current_exe: {e}")))?;
            let content = format!(
                "[Desktop Entry]\n\
                 Type=Application\n\
                 Version=1.0\n\
                 Name={APP_NAME}\n\
                 GenericName={APP_GENERIC}\n\
                 Comment={APP_COMMENT}\n\
                 Exec={exec}\n\
                 TryExec={try_exec}\n\
                 Icon={APP_ID}\n\
                 Terminal=false\n\
                 StartupNotify=false\n\
                 Categories=Utility;Mouse;\n\
                 Keywords=mouse;wheel;scroll;smooth;input;\n\
                 X-GNOME-Autostart-enabled=true\n\
                 X-GNOME-Bugzilla-Bugzilla=GNOME\n\
                 X-GNOME-Bugzilla-Product=SmoothScroll\n\
                 X-GNOME-Bugzilla-Component=Main\n\
                 Hidden=false\n\
                 NoDisplay=false\n",
                exec = exec,
                try_exec = exe_raw.to_string_lossy(),
            );
            fs::write(&path, content)
                .map_err(|e| PlatformError::Os(format!("write .desktop: {e}")))?;
        } else if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| PlatformError::Os(format!("remove .desktop: {e}")))?;
        }
        Ok(())
    }
}
