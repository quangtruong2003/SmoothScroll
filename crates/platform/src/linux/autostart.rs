//! XDG autostart via ~/.config/autostart/smoothscroll.desktop.

use crate::traits::Autostart;
use crate::types::{PlatformError, Result};
use std::fs;
use std::path::PathBuf;

const DESKTOP_ENTRY: &str = "\
[Desktop Entry]
Type=Application
Name=SmoothScroll
Exec={exec}
X-GNOME-Autostart-enabled=true
Comment=Smooth scrolling for every application
";

pub struct LinuxAutostart;

impl LinuxAutostart {
    fn desktop_path() -> Result<PathBuf> {
        let home = std::env::var("HOME").map_err(|_| PlatformError::Os("HOME not set".into()))?;
        Ok(PathBuf::from(home)
            .join(".config")
            .join("autostart")
            .join("smoothscroll.desktop"))
    }

    fn exec_path() -> Result<String> {
        std::env::current_exe()
            .map_err(|e| PlatformError::Os(format!("current_exe: {e}")))
            .map(|p| format!("\"{}\"", p.to_string_lossy()))
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
            let content = DESKTOP_ENTRY.replace("{exec}", &exec);
            fs::write(&path, content)
                .map_err(|e| PlatformError::Os(format!("write .desktop: {e}")))?;
        } else if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| PlatformError::Os(format!("remove .desktop: {e}")))?;
        }
        Ok(())
    }
}
