# Design: Linux Wayland Support for SmoothScroll

**Issue:** [#2 — on linux support](https://github.com/quangtruong2003/SmoothScroll/issues/2)
**Date:** 2026-06-22
**Status:** Approved (ready for implementation)

## Problem

SmoothScroll currently supports Linux X11 only. When `XDG_SESSION_TYPE=wayland`, users see:

```
"Wayland session detected. SmoothScroll requires X11.
 Please log out and select 'GNOME on Xorg' or equivalent."
```

This affects a significant portion of Linux users, especially those on modern distros (Fedora 40+, Ubuntu 24.04+, openSUSE Tumbleweed) where Wayland is the default.

## Approach

Implement Wayland support using a hybrid approach:

1. **X11 fallback** — Keep existing X11 implementation for `XDG_SESSION_TYPE=x11`
2. **Wayland native** — New implementation using `evdev` + `uinput` for scroll interception and injection

### Why evdev + uinput (not libei)?

| Approach | Pros | Cons |
|----------|------|------|
| **evdev + uinput** | Works on ALL compositors, no portal needed | Requires `input` group membership |
| **libei + portal** | Official Wayland way, permission handled | Limited Rust bindings, portal complexity |
| **wlr protocols** | Native on Wlroots compositors | Sway/Hyprland only, not GNOME/KDE |

**Decision:** `evdev + uinput` for maximum compatibility. This is the same approach used by [rinertia](https://github.com/JimMoen/rinertia) and [wayland-wheeltani](https://crates.io/crates/wayland-wheeltani).

---

## Architecture

### Module Structure

```
crates/platform/src/linux/
├── mod.rs              ← Detect X11 vs Wayland, dispatch
├── mouse_hook.rs       ← X11 XInput2 (existing, no change)
├── wheel_emitter.rs    ← X11 XTest (existing, no change)
├── process_query.rs    ← X11 EWMH (existing, no change)
├── hotkey.rs           ← X11 XGrabKey (existing, no change)
├── keyboard.rs        ← X11 XQueryKeymap (existing, no change)
├── fullscreen.rs       ← X11 _NET_WM_STATE (existing, no change)
├── window_geom.rs      ← X11 XQueryPointer (existing, no change)
├── autostart.rs        ← XDG autostart (same for both)
├── accessibility.rs     ← Stub (same for both)
├── timer.rs            ← No-op (same for both)
└── wayland/
    ├── mod.rs           ← Wayland module entry
    ├── evdev_scanner.rs ← Discover scroll devices
    ├── mouse_hook.rs    ← evdev scroll interception (with grab)
    ├── wheel_emitter.rs ← uinput scroll injection
    ├── process_query.rs ← /proc walking
    ├── hotkey.rs        ← Stub (warn on use)
    ├── keyboard.rs      ← evdev key sampling
    ├── fullscreen.rs    ← Stub (false)
    ├── permission.rs    ← uinput access check + setup guidance
    └── hotplug.rs       ← Device hotplug monitoring
```

**Note:** No refactoring of existing X11 files. We keep them in place and add `wayland/` subdirectory.

---

## Dependencies

### Cargo.toml

```toml
[target.'cfg(all(target_os = "linux", not(target_env = "musl")))'.dependencies]
evdev = "0.14"
nix = { version = "0.29", features = ["fs", "ioctl"] }
libc = "0.2"
```

**Note:** We exclude musl targets (Alpine Linux) since evdev requires glibc.

### System Packages

```bash
# Ubuntu/Debian
sudo apt install libevdev-dev pkg-config

# Fedora
sudo dnf install libevdev-devel

# Arch
sudo pacman -S libevdev
```

---

## Component Details

### 1. Permission Check — `/dev/uinput` Access

```rust
// wayland/permission.rs

/// Check if we have write access to /dev/uinput
pub fn check_uinput_access() -> Result<()> {
    match std::fs::OpenOptions::new().write(true).open("/dev/uinput") {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == ErrorKind::PermissionDenied => {
            Err(PlatformError::Os(
                "SmoothScroll needs access to /dev/uinput for scroll smoothing.\n\n\
                 Run: sudo gpasswd -a $USER input\n\
                 Then log out and log back in.\n\n\
                 If using Flatpak, use .deb or .AppImage instead.".into()
            ))
        }
        Err(e) => Err(PlatformError::Os(format!("/dev/uinput: {e}"))),
    }
}

/// Check if running in Flatpak sandbox
pub fn is_flatpak() -> bool {
    std::path::Path::new("/.flatpak-info").exists()
}
```

---

### 2. evdev Scanner — Device Discovery

```rust
// wayland/evdev_scanner.rs
use evdev::{Device, EventType, InputId, EventKind};
use std::path::PathBuf;
use nix::dir::Dir;

pub struct EvdevScanner;

impl EvdevScanner {
    /// Scan /dev/input/ for devices with scroll capability
    pub fn find_scroll_devices() -> Result<Vec<Device>> {
        let mut devices = Vec::new();
        
        // Enumerate /dev/input/event*
        let input_dir = Dir::open("/dev/input", nix::fcntl::OFlag::O_RDONLY, nix::sys::stat::Mode::empty())
            .map_err(|e| PlatformError::Os(format!("open /dev/input: {e}")))?;
        
        for entry in input_dir.iter() {
            let entry = entry.map_err(|e| PlatformError::Os(format!("read dir: {e}")))?;
            let name = entry.file_name().to_string_lossy();
            
            // Only process event* files
            if !name.starts_with("event") {
                continue;
            }
            
            let path = PathBuf::from("/dev/input").join(&*name);
            let path_str = path.to_string_lossy();
            
            // Open device
            let device = match Device::open(&path_str) {
                Ok(d) => d,
                Err(_) => continue,  // Can't open, skip
            };
            
            // Check if it's a virtual device (uinput)
            if Self::is_virtual_device(&device) {
                continue;
            }
            
            // Check if device has scroll capability
            if Self::has_scroll_capability(&device) {
                devices.push(device);
            }
        }
        
        if devices.is_empty() {
            return Err(PlatformError::Os(
                "No scroll devices detected. SmoothScroll requires a mouse or touchpad.".into()
            ));
        }
        
        Ok(devices)
    }
    
    fn is_virtual_device(device: &Device) -> bool {
        // Check device name for common virtual device patterns
        if let Ok(name) = device.name() {
            let name = name.to_lowercase();
            return name.contains("virtual") 
                || name.contains("uinput")
                || name.contains("virtual mouse")
                || name.contains("smoothscroll");
        }
        false
    }
    
    fn has_scroll_capability(device: &Device) -> bool {
        // Check EV_REL for scroll events
        device.has_event_type(EventType::REL_WHEEL)
            || device.has_event_type(EventType::REL_HWHEEL)
            || device.has_event_type(EventType::REL_WHEEL_HI_RES)
            || device.has_event_type(EventType::REL_HWHEEL_HI_RES)
    }
}
```

---

### 3. MouseHook — evdev with Exclusive Grab

**⚠️ Important:** This implementation uses `GRAB_MODE_EXCLUSIVE` which prevents other applications from receiving scroll events.

```rust
// wayland/mouse_hook.rs
use evdev::{Device, EventType, EventKind};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

pub struct WaylandMouseHook {
    devices: Vec<Device>,
    stop_flag: Arc<AtomicBool>,
}

impl WaylandMouseHook {
    pub fn new() -> Result<Self> {
        let devices = EvdevScanner::find_scroll_devices()?;
        Ok(Self {
            devices,
            stop_flag: Arc::new(AtomicBool::new(false)),
        })
    }
}

impl MouseHook for WaylandMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let alive = self.stop_flag.clone();
        let sink = Arc::new(sink);
        let classifier_v = Arc::new(Mutex::new(InputClassifier::new()));
        let classifier_h = Arc::new(Mutex::new(InputClassifier::new()));
        
        // Clone devices for the thread
        let mut device_paths = Vec::new();
        for device in &self.devices {
            if let Ok(path) = device.file_path().map(|p| p.to_path_buf()) {
                device_paths.push(path);
            }
        }
        
        thread::Builder::new()
            .name("ss-wayland-wheel-hook".into())
            .spawn(move || {
                // Re-open devices in the thread (Device doesn't impl Send)
                let devices: Vec<_> = device_paths
                    .iter()
                    .filter_map(|p| {
                        Device::open(p.to_string_lossy().as_ref()).ok()
                    })
                    .collect();
                
                // Grab devices to intercept scroll events
                for device in &devices {
                    if let Err(e) = device.grab(evdev::GrabMode::Exclusive) {
                        eprintln!("Failed to grab device {:?}: {e}", device.name());
                    }
                }
                
                // Event stream for each device
                let streams: Vec<_> = devices
                    .into_iter()
                    .filter_map(|d| d.into_event_stream().ok())
                    .collect();
                
                while alive.load(Ordering::Relaxed) {
                    for stream in &streams {
                        // read_event() with timeout
                        if let Ok(event) = stream.read_event() {
                            let event = event.unwrap();  // sync_read is infallible
                            Self::process_event(event, &classifier_v, &classifier_h, &sink);
                        }
                    }
                    thread::sleep(Duration::from_micros(100));
                }
            })
            .map_err(|e| PlatformError::Os(format!("spawn mouse hook: {e}")))?;
        
        Ok(HookHandle::new(Box::new(Installed { alive })))
    }
}

impl WaylandMouseHook {
    fn process_event(
        event: InputEvent,
        classifier_v: &Arc<Mutex<InputClassifier>>,
        classifier_h: &Arc<Mutex<InputClassifier>>,
        sink: &Arc<dyn HookEventSink>,
    ) {
        // Skip if we're emitting (feedback loop prevention)
        if crate::linux::wheel_emitter::is_suppressing() {
            return;
        }
        
        let now = Instant::now();
        
        match event.kind() {
            EventKind::RelWheel { value } => {
                let source = classifier_v.lock().classify(value, now);
                sink.on_wheel_ext(value, 0, source);  // TODO: pass modifiers
            }
            EventKind::RelHorizontalWheel { value } => {
                let source = classifier_h.lock().classify(value, now);
                sink.on_hwheel_ext(value, source);
            }
            EventKind::RelWheelHiRes { value } => {
                // Accumulate hi-res units, emit at 120-unit boundaries
                // TODO: implement accumulation
                sink.on_wheel_ext(value / 120, 0, WheelSource::Finger);
            }
            EventKind::RelHorizontalWheelHiRes { value } => {
                sink.on_hwheel_ext(value / 120, WheelSource::Finger);
            }
            _ => {}
        }
    }
}
```

**Limitation:** Other input tools (fusuma, libinput-gestures, etc.) will not receive scroll events while SmoothScroll is running. Users must choose one tool.

---

### 4. WheelEmitter — uinput Injection

```rust
// wayland/wheel_emitter.rs
use std::fs::{File, OpenOptions};
use std::io::Write as IoWrite;
use std::os::unix::io::{AsRawFd, FromRawFd, IntoRawFd};
use std::sync::atomic::{AtomicBool, Ordering};
use nix::ioctl_write_int;

static SUPPRESSING: AtomicBool = AtomicBool::new(false);

pub fn is_suppressing() -> bool {
    SUPPRESSING.load(Ordering::Acquire)
}

// uinput ioctls
ioctl_write_int!(ui_set_evbit, UI_SET_EVBIT, 0);
ioctl_write_int!(ui_set_relbit, UI_SET_RELBIT, 0);
ioctl_write_int!(ui_set_keybit, UI_SET_KEYBIT, 0);
ioctl_write_int!(ui_dev_create, UI_DEV_CREATE, 0);
ioctl_write_int!(ui_dev_destroy, UI_DEV_DESTROY, 0);

pub struct WaylandWheelEmitter {
    fd: File,
}

impl WaylandWheelEmitter {
    pub fn new() -> Result<Self> {
        let fd = OpenOptions::new()
            .write(true)
            .open("/dev/uinput")
            .map_err(|e| PlatformError::Os(format!("/dev/uinput: {e}")))?;
        
        // Setup virtual mouse with wheel + keyboard (for Ctrl zoom)
        unsafe {
            let fd = fd.as_raw_fd();
            
            // Enable EV_REL events
            ui_set_evbit(fd, nix::libc::EV_REL as i32)?;
            
            // Enable wheel events
            ui_set_relbit(fd, nix::libc::REL_WHEEL as i32)?;
            ui_set_relbit(fd, 0x0c as i32)?;  // REL_WHEEL_HI_RES (defined in linux/input.h)
            ui_set_relbit(fd, nix::libc::REL_HWHEEL as i32)?;
            ui_set_relbit(fd, 0x0d as i32)?;  // REL_HWHEEL_HI_RES
            
            // Enable key events (for Ctrl during zoom)
            ui_set_evbit(fd, nix::libc::EV_KEY as i32)?;
            ui_set_keybit(fd, nix::libc::KEY_LEFTCTRL as i32)?;
            ui_set_keybit(fd, nix::libc::KEY_RIGHTCTRL as i32)?;
            
            // Set up device
            let mut uinput_user_dev = nix::libc::uinput_user_dev {
                name: [0i8; 80],
                id: nix::libc::input_id {
                    bustype: nix::libc::BUS_USB,
                    vendor: 0x1234,
                    product: 0x5678,
                    ..Default::default()
                },
                ff_effects_max: 0,
                absmax: [0i32; nix::libc::ABS_CNT as usize],
                absmin: [0i32; nix::libc::ABS_CNT as usize],
                absfuzz: [0i32; nix::libc::ABS_CNT as usize],
                absflat: [0i32; nix::libc::ABS_CNT as usize],
            };
            
            // Set device name
            let name = b"SmoothScroll Virtual Mouse\0";
            for (i, &byte) in name.iter().take(80).enumerate() {
                uinput_user_dev.name[i] = byte as i8;
            }
            
            // Write device config
            std::ptr::write_bytes(
                (&mut uinput_user_dev as *mut _ as *mut u8),
                0,
                std::mem::size_of::<nix::libc::uinput_user_dev>()
            );
            
            // Copy name again (was zeroed)
            for (i, &byte) in name.iter().take(80).enumerate() {
                uinput_user_dev.name[i] = byte as i8;
            }
            
            // Create device
            ui_dev_create(fd)?;
        }
        
        Ok(Self { fd })
    }
}

impl Drop for WaylandWheelEmitter {
    fn drop(&mut self) {
        unsafe {
            let _ = ui_dev_destroy(self.fd.as_raw_fd());
        }
    }
}

impl WheelEmitter for WaylandWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        SUPPRESSING.store(true, Ordering::Release);
        
        let fd = self.fd.as_raw_fd();
        
        // Emit Ctrl keydown for zoom
        if vertical_units != 0 {
            // If we detect zoom pattern (large units), inject Ctrl
            if vertical_units.abs() > 5 {
                self.inject_key(nix::libc::KEY_LEFTCTRL, 1)?;
            }
        }
        
        // Emit wheel events
        for _ in 0..vertical_units.abs() {
            self.inject_wheel(nix::libc::REL_WHEEL, vertical_units.signum())?;
        }
        
        for _ in 0..horizontal_units.abs() {
            self.inject_wheel(nix::libc::REL_HWHEEL, horizontal_units.signum())?;
        }
        
        // Release Ctrl
        if vertical_units.abs() > 5 {
            self.inject_key(nix::libc::KEY_LEFTCTRL, 0)?;
        }
        
        // Brief delay before unblocking hook
        std::thread::sleep(Duration::from_micros(500));
        SUPPRESSING.store(false, Ordering::Release);
        
        Ok(())
    }
}

impl WaylandWheelEmitter {
    fn inject_wheel(&self, event: i32, value: i32) -> Result<()> {
        let fd = self.fd.as_raw_fd();
        
        let mut ev = nix::libc::input_event {
            time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
            type_: nix::libc::EV_REL as u16,
            code: event as u16,
            value,
        };
        
        unsafe {
            let ret = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
            if ret < 0 {
                return Err(PlatformError::Os(format!("write wheel: {}", nix::errno::errno())));
            }
            
            // Send SYN_REPORT
            ev = nix::libc::input_event {
                time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
                type_: nix::libc::EV_SYN as u16,
                code: 0,
                value: 0,
            };
            let ret = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
            if ret < 0 {
                return Err(PlatformError::Os(format!("write syn: {}", nix::errno::errno())));
            }
        }
        
        Ok(())
    }
    
    fn inject_key(&self, key: i32, value: i32) -> Result<()> {
        let fd = self.fd.as_raw_fd();
        
        let mut ev = nix::libc::input_event {
            time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
            type_: nix::libc::EV_KEY as u16,
            code: key as u16,
            value,
        };
        
        unsafe {
            let ret = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
            if ret < 0 {
                return Err(PlatformError::Os(format!("write key: {}", nix::errno::errno())));
            }
            
            // SYN_REPORT
            ev = nix::libc::input_event {
                time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
                type_: nix::libc::EV_SYN as u16,
                code: 0,
                value: 0,
            };
            let _ = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
        }
        
        Ok(())
    }
}
```

---

### 5. Device Hotplug — udev Monitor

```rust
// wayland/hotplug.rs
use std::thread;
use std::path::PathBuf;
use nix::sys::inotify::{Inotify, InotifyWatcher, InitFlags};
use std::sync::atomic::{AtomicBool, Ordering};

pub struct DeviceHotplugMonitor {
    stop_flag: Arc<AtomicBool>,
}

impl DeviceHotplugMonitor {
    pub fn new<F>(on_device_change: F) -> Result<Self>
    where
        F: Fn() + Send + 'static,
    {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let on_change = on_device_change;
        
        thread::Builder::new()
            .name("ss-wayland-hotplug".into())
            .spawn(move || {
                let inotify = match Inotify::init(InitFlags::IN_NONBLOCK) {
                    Ok(i) => i,
                    Err(_) => return,  // inotify not available
                };
                
                if inotify.add_watch("/dev/input", nix::sys::inotify::IN_CREATE | nix::sys::inotify::IN_DELETE).is_err() {
                    return;
                }
                
                let mut buf = [0u8; 1024];
                
                while !stop_flag.load(Ordering::Relaxed) {
                    if let Ok(events) = inotify.read_events(&mut buf) {
                        for event in events {
                            if event.mask.contains(nix::sys::inotify::IN_CREATE)
                                || event.mask.contains(nix::sys::inotify::IN_DELETE) {
                                on_change();
                            }
                        }
                    }
                    thread::sleep(Duration::from_secs(1));
                }
            })
            .ok();
        
        Ok(Self { stop_flag })
    }
}

impl Drop for DeviceHotplugMonitor {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}
```

**Note:** On device change, SmoothScroll should:
1. Re-scan devices
2. Re-grab new devices
3. Update internal device list

---

### 6. ProcessQuery — /proc Walking

```rust
// wayland/process_query.rs
use std::fs;

pub struct WaylandProcessQuery;

impl ProcessQuery for WaylandProcessQuery {
    fn foreground_window(&self) -> Option<WindowId> {
        // On Wayland, we don't have a reliable way to get foreground window
        // without compositor-specific APIs
        // Return None - scroll will apply to all windows equally
        None
    }
    
    fn process_name(&self, window: WindowId) -> Option<String> {
        // Get process name from /proc/<pid>/comm
        if let Some(pid) = self.get_window_pid(window) {
            let comm_path = format!("/proc/{}/comm", pid);
            if let Ok(name) = fs::read_to_string(comm_path) {
                return Some(name.trim().to_string());
            }
        }
        None
    }
    
    fn is_elevated(&self, _pid: u32) -> bool {
        // Linux doesn't have UAC/elevation in the same way
        // Check if running as root
        unsafe { nix::libc::geteuid() == 0 }
    }
    
    fn window_title(&self, _window: WindowId) -> Option<String> {
        // Wayland doesn't expose window titles to clients by default
        None
    }
}
```

---

### 7. Hotkey — Stub with Warning

```rust
// wayland/hotkey.rs
use std::sync::atomic::{AtomicBool, Ordering};

static HOTKEYS_AVAILABLE: AtomicBool = AtomicBool::new(false);

pub fn are_hotkeys_available() -> bool {
    HOTKEYS_AVAILABLE.load(Ordering::Relaxed)
}

pub struct WaylandHotkey;

impl Hotkey for WaylandHotkey {
    fn register(&self, accelerator: String, _callback: Box<dyn Fn()>) -> Result<()> {
        if !are_hotkeys_available() {
            eprintln!(
                "Warning: Global hotkeys are not available on Wayland.\n\
                 The accelerator '{}' will not be registered.\n\
                 To enable hotkeys, use X11 session instead.", 
                accelerator
            );
            return Ok(());
        }
        
        // TODO: Implement via xdg-desktop-portal when available
        Err(PlatformError::Unimplemented("hotkey"))
    }
}
```

---

### 8. Keyboard State — evdev Sampling

```rust
// wayland/keyboard.rs
use std::sync::{Arc, Mutize};
use std::thread;
use std::time::Duration;

pub struct KeyboardState {
    modifiers: Mutex<ModifierState>,
    stop_flag: Arc<AtomicBool>,
}

impl KeyboardState {
    pub fn start() -> Arc<Self> {
        let state = Arc::new(Self {
            modifiers: Mutex::new(ModifierState::default()),
            stop_flag: Arc::new(AtomicBool::new(false)),
        });
        
        let s = state.clone();
        thread::Builder::new()
            .name("ss-keyboard-sampler".into())
            .spawn(move || {
                // Open any keyboard device
                if let Ok(device) = evdev::Device::open("/dev/input/by-path/platform-i8042-serio-0-event-kbd") {
                    s.sample_loop(device);
                }
            })
            .ok();
        
        state
    }
    
    fn sample_loop(&self, device: evdev::Device) {
        let stream = match device.into_event_stream() {
            Ok(s) => s,
            Err(_) => return,
        };
        
        while !self.stop_flag.load(Ordering::Relaxed) {
            if let Ok(event) = stream.read_event() {
                if let Ok(event) = event {
                    self.update_modifiers(event);
                }
            }
            thread::sleep(Duration::from_millis(16));  // ~60Hz
        }
    }
    
    fn update_modifiers(&self, event: InputEvent) {
        use evdev::EventKind;
        
        if let EventKind::Key(key) = event.kind() {
            let pressed = event.value() == 1;
            let mut mods = self.modifiers.lock().unwrap();
            
            match key {
                evdev::Key::KEY_LEFTSHIFT | evdev::Key::KEY_RIGHTSHIFT => {
                    mods.shift = pressed;
                }
                evdev::Key::KEY_LEFTCTRL | evdev::Key::KEY_RIGHTCTRL => {
                    mods.ctrl = pressed;
                }
                evdev::Key::KEY_LEFTALT | evdev::Key::KEY_RIGHTALT => {
                    mods.alt = pressed;
                }
                _ => {}
            }
        }
    }
}
```

---

### 9. Fullscreen Detection — Stub (False)

```rust
// wayland/fullscreen.rs
pub struct WaylandFullscreenDetector;

impl FullscreenDetector for WaylandFullscreenDetector {
    fn is_fullscreen(&self, _window: WindowId) -> bool {
        // Wayland doesn't provide a standard protocol for this
        // Return false (safe default - we'll still process scroll)
        false
    }
}
```

---

## Setup Script

```bash
#!/bin/bash
# smoothscroll-setup.sh
# Run this once after installing SmoothScroll on Linux Wayland

set -e

echo "Setting up SmoothScroll for Wayland..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Error: Do not run as root. Run as your normal user."
    exit 1
fi

# Add to input group
echo "Adding user to 'input' group..."
sudo gpasswd -a "$USER" input

# Create udev rule for uinput
echo "Creating udev rule..."
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
    | sudo tee /etc/udev/rules.d/99-smoothscroll.rules

# Reload udev
echo "Reloading udev rules..."
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input

echo ""
echo "Setup complete!"
echo ""
echo "IMPORTANT: Please log out and log back in for group changes to take effect."
echo "After logging back in, you can start SmoothScroll."
```

---

## Error Handling

### Startup Flow

```
┌─────────────────────────────────────────────────────┐
│ Check XDG_SESSION_TYPE                               │
├────────────────┬────────────────────────────────────┤
│ X11            │ Wayland                            │
├────────────────┼────────────────────────────────────┤
│ Existing path  │ Check Flatpak?                     │
│                ├────────────────────────────────────┤
│                │ Flatpak? → Show Flatpak not       │
│                │           supported error          │
│                ├────────────────────────────────────┤
│                │ Check /dev/uinput access          │
│                ├────────────────┬───────────────────┤
│                │ Can write      │ Cannot write      │
│                ├────────────────┼───────────────────┤
│                │ Find evdev     │ Show setup script │
│                │ devices        │ instructions      │
│                ├────────────────┴───────────────────┤
│                │ Grab devices + start hook         │
└────────────────┴────────────────────────────────────┘
```

### Error Messages

| Scenario | Message |
|----------|---------|
| Flatpak detected | "SmoothScroll does not support Flatpak. Please install from .deb or .AppImage instead." |
| Cannot open `/dev/uinput` | "SmoothScroll needs access to /dev/uinput. Run the setup script and log out." |
| No scroll devices found | "No scroll devices detected. Connect a mouse or touchpad." |
| Device grab failed | "Another application may be using scroll input. Close other input tools." |
| Hotplug error | Log warning, continue with current devices |

---

## Frontend Changes

### Platform-Specific UI

```tsx
// BehaviorSection.tsx
<div className={cn("platform-warning", { hidden: platform !== 'linux-wayland' })}>
  <AlertTriangleIcon />
  <span>
    {t('linux_wayland_limited')}
    <a href="/docs/wayland-support">{t('learn_more')}</a>
  </span>
</div>

// Disable hotkey settings on Wayland
{platform === 'linux-wayland' && (
  <Tooltip content={t('wayland_hotkey_limitation')}>
    <Switch disabled />
  </Tooltip>
)}

// Setup wizard on first run
{needsSetup && (
  <SetupWizard onComplete={handleSetupComplete} />
)}
```

### Translations

```json
{
  "linux_wayland_limited": "Wayland support is experimental. Some features may be limited.",
  "wayland_hotkey_limitation": "Global hotkeys are not available on Wayland. Use X11 for hotkey support.",
  "linux_setup_required": "Linux Wayland setup required",
  "linux_setup_instructions": "Run the setup script and log out:\nbash smoothscroll-setup.sh",
  "linux_flatpak_not_supported": "Flatpak is not supported. Please use .deb or .AppImage."
}
```

---

## Testing Strategy

### Unit Tests

```bash
# Test permission check
cargo test --package smoothscroll_platform -- wayland::permission

# Test evdev scanner (mock /dev/input)
cargo test --package smoothscroll_platform -- wayland::evdev_scanner

# Test wheel emitter
cargo test --package smoothscroll_platform -- wayland::wheel_emitter
```

### Integration Tests

1. **Device fixture:** Use `evtest` or mock evdev device
2. **Event injection test:** Verify uinput events are well-formed
3. **Feedback loop test:** Verify suppression flag works

### Manual Testing Matrix

| Distro | Desktop | Session | Status | Notes |
|--------|---------|---------|--------|-------|
| Ubuntu 24.04 | GNOME | Wayland | ? | Primary target |
| Ubuntu 24.04 | GNOME | X11 | ✅ | Existing |
| Fedora 41 | GNOME | Wayland | ? | |
| Fedora 41 | KDE | Wayland | ? | KWin specific |
| Arch | Sway | Wayland | ? | Wlroots |
| Arch | Hyprland | Wayland | ? | Wlroots variant |
| openSUSE | KDE | Wayland | ? | |

### CI/CD

```yaml
# .github/workflows/linux-test.yml
name: Linux Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: |
          apt-get update
          apt-get install -y libevdev-dev pkg-config
      - name: Build
        run: cargo build --package smoothscroll_platform
      - name: Unit tests
        run: cargo test --package smoothscroll_platform
```

---

## Known Limitations

1. **Exclusive grab** — Other input tools (fusuma, etc.) won't receive scroll events
2. **Global hotkeys** — Not implemented (Wayland restriction)
3. **Permission setup** — Requires user to run setup script and log out
4. **Flatpak** — Not supported (sandbox blocks `/dev/uinput`)
5. **Device conflicts** — May conflict with other apps that grab input
6. **Touchpad inertia** — Not implemented (compositor responsibility)

---

## Out of Scope (Future Phases)

- [ ] Global hotkey support via xdg-desktop-portal
- [ ] Touchpad inertia/momentum scrolling
- [ ] Per-app scroll speed profiles
- [ ] HiDPI / fractional scaling support
- [ ] Wayland protocol-based fullscreen detection
- [ ] KDE/GNOME specific integrations

---

## Implementation Phases

### Phase 1: Core (This PR)
- [ ] Session detection (X11 vs Wayland)
- [ ] Permission check + Flatpak detection
- [ ] evdev scanner + device list
- [ ] WaylandMouseHook with exclusive grab
- [ ] WaylandWheelEmitter with uinput
- [ ] Feedback loop prevention (suppression flag)
- [ ] Basic keyboard state sampling
- [ ] Setup script

### Phase 2: Polish
- [ ] Device hotplug monitoring
- [ ] Better error messages
- [ ] Process query (/proc walking)

### Phase 3: Hotkeys (Future)
- [ ] xdg-desktop-portal GlobalShortcuts integration
- [ ] KDE Plasma integration
- [ ] GNOME extension fallback

---

## Appendix: Reference Projects

| Project | Language | Method | URL |
|---------|----------|--------|-----|
| rinertia | Rust | evdev + uinput | https://github.com/JimMoen/rinertia |
| wayland-wheeltani | Rust | evdev + uinput | https://crates.io/crates/wayland-wheeltani |
| wdotool | Rust | libei + wlr protocols | https://github.com/cushycush/wdotool |
| fusuma | Ruby | evdev + libinput | https://github.com/iberianpig/fusuma |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-06-22 | Initial draft |
| v2 | 2026-06-22 | Fix review issues: grab docs, evdev API, no x11/ refactor, Flatpak detection, keyboard state, hotplug, process_query |
