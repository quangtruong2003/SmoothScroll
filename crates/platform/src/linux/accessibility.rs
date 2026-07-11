//! Linux accessibility signals via GTK settings and GNOME Shell.
//!
//! On GNOME: Reads gsettings org.gnome.desktop.interface enable-animations
//! On KDE: Reads kreadconfig5 AnimationDurationScale
//! Fallback: Returns false (no reduce motion)

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct LinuxAccessibilitySignals;

impl LinuxAccessibilitySignals {
    /// Check if reduce motion is enabled via desktop settings.
    fn detect_reduce_motion() -> bool {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();

        if desktop.contains("gnome") {
            Self::gnome_reduce_motion()
        } else if desktop.contains("kde") || desktop.contains("plasma") {
            Self::kde_reduce_motion()
        } else {
            false
        }
    }

    /// Check GNOME animations setting via gsettings.
    fn gnome_reduce_motion() -> bool {
        let output = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "enable-animations"])
            .output()
            .ok();

        match output {
            Some(o) if o.status.success() => {
                let value = String::from_utf8_lossy(&o.stdout);
                // 'false' means reduce motion is ON
                value.trim() == "false"
            }
            _ => false,
        }
    }

    /// Check KDE animation scale via kreadconfig5.
    fn kde_reduce_motion() -> bool {
        let output = std::process::Command::new("kreadconfig5")
            .args([
                "--file",
                "kdeglobals",
                "--group",
                "KDE",
                "--key",
                "AnimationDurationScale",
            ])
            .output()
            .ok();

        match output {
            Some(o) if o.status.success() => {
                let value = String::from_utf8_lossy(&o.stdout);
                value
                    .trim()
                    .parse::<f64>()
                    .map(|v| v <= 0.0)
                    .unwrap_or(false)
            }
            _ => false,
        }
    }
}

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        Self::detect_reduce_motion()
    }

    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        tracing::debug!(
            "Accessibility watch not implemented on Linux. \
             Reduce motion changes won't be detected until restart."
        );
        Ok(HookHandle::new(Box::new(())))
    }
}
