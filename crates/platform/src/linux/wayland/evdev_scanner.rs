//! evdev device scanner for finding scroll-capable input devices.
//!
//! Scans /dev/input/event* for devices with wheel/horizontal wheel
//! capability and filters out virtual devices (uinput).

use crate::types::{PlatformError, Result};
use std::path::PathBuf;

/// Find all scroll-capable input devices.
pub fn find_scroll_devices() -> Result<Vec<DeviceInfo>> {
    let mut devices = Vec::new();

    // Read directory
    let entries = std::fs::read_dir("/dev/input")
        .map_err(|e| PlatformError::Os(format!("Cannot read /dev/input: {e}")))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Only process event* files
        if !name.starts_with("event") {
            continue;
        }

        let path_str = path.to_string_lossy();

        // Open device
        let device = match evdev::Device::open(&*path_str) {
            Ok(d) => d,
            Err(_) => continue, // Can't open, skip
        };

        // Check if it's a virtual device (uinput)
        if is_virtual_device(&device) {
            continue;
        }

        // Check if device has scroll capability
        if has_scroll_capability(&device) {
            let dev_name = device.name().unwrap_or("<unknown>").to_string();
            let path = path.to_path_buf();
            devices.push(DeviceInfo {
                name: dev_name,
                path,
            });
        }
    }

    if devices.is_empty() {
        return Err(PlatformError::Os(
            "No scroll devices detected.\n\n\
             SmoothScroll requires a mouse or touchpad with scroll capability."
                .into(),
        ));
    }

    Ok(devices)
}

fn is_virtual_device(device: &evdev::Device) -> bool {
    if let Some(name) = device.name() {
        let name = name.to_lowercase();
        return name.contains("virtual")
            || name.contains("uinput")
            || name.contains("smoothscroll");
    }
    false
}

fn has_scroll_capability(device: &evdev::Device) -> bool {
    use evdev::EventType;

    device.supported_events().contains(EventType::RELATIVE)
}

#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub name: String,
    pub path: PathBuf,
}
