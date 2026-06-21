//! Permission checks for Wayland support.
//!
//! Wayland requires access to /dev/uinput which requires either:
//! - Membership in the 'input' group
//! - Root privileges
//! - Polkit authorization
//!
//! We also check for Flatpak sandbox which blocks /dev/uinput access.

use crate::types::{PlatformError, Result};

/// Check if running inside Flatpak sandbox.
pub fn is_flatpak() -> bool {
    std::path::Path::new("/.flatpak-info").exists()
}

/// Check if we have write access to /dev/uinput.
pub fn check_uinput_access() -> Result<()> {
    if is_flatpak() {
        return Err(PlatformError::Os(
            "SmoothScroll does not support Flatpak.\n\n\
             Flatpak sandbox blocks access to /dev/uinput which is \
             required for scroll interception.\n\n\
             Please install SmoothScroll from .deb or .AppImage instead.".into()
        ));
    }
    
    match std::fs::OpenOptions::new().write(true).open("/dev/uinput") {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            Err(PlatformError::Os(
                "SmoothScroll needs access to /dev/uinput for scroll smoothing.\n\n\
                 Run the following commands and log out:\n\n\
                   sudo gpasswd -a $USER input\n\
                   sudo bash -c 'echo \"KERNEL==\\\"uinput\\\", GROUP=\\\"input\\\", \
                 MODE=\\\"0660\\\", OPTIONS+=\\\"static_node=uinput\\\"\" > \
                 /etc/udev/rules.d/99-smoothscroll.rules'\n\
                   sudo udevadm control --reload-rules\n\n\
                 After logging back in, restart SmoothScroll.".into()
            ))
        }
        Err(e) => Err(PlatformError::Os(format!(
            "Cannot open /dev/uinput: {e}"
        ))),
    }
}
