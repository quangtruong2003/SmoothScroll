# Tray Panel Row Polish + Real App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten tray panel icon-to-label spacing, prefix labels with category, and replace generic Lucide icons with real foreground-app icons (Windows + macOS).

**Architecture:** Cross-platform Rust extractor (`crates/platform/src/icon.rs`) caches per-pid base64 PNGs. `ForegroundAppContext` carries an `app_icon_base64: Option<String>`. Frontend renders `<img data:...>` when present, falls back to Lucide otherwise. CSS shrinks `.tray-row` grid columns/gap.

**Tech Stack:** Rust (windows-icons 0.3, objc2-app-kit NSBitmapImageRep, /proc readlink for Linux), TypeScript (React + lucide-react), CSS Grid.

**Spec:** `docs/superpowers/specs/2026-07-08-tray-panel-row-polish-design.md`

---

## File Structure

| Layer | Files | Responsibility |
|-------|-------|----------------|
| Backend traits | `crates/platform/src/traits.rs` | Extend `ProcessInfo` with `exe_path`; new `foreground_process_info()` trait method with default None |
| Windows impl | `crates/platform/src/windows/process_query.rs` | Implement `foreground_process_info()` via Win32 + populate `exe_path` in `enumerate()` |
| macOS impl | `crates/platform/src/macos/process_query.rs` | Implement `foreground_process_info()` via NSWorkspace + populate `exe_path` in `list_visible_processes()` |
| Linux impl | `crates/platform/src/linux/process_query.rs` | Implement `foreground_process_info()` via /proc + populate `exe_path` in `list_visible_processes()` |
| Icon extractor (new) | `crates/platform/src/icon.rs` | Per-platform extraction + `IconCache` (LRU, cap 32) |
| Icon module export | `crates/platform/src/lib.rs` | `pub mod icon;` |
| Cargo dep | `crates/platform/Cargo.toml` | Add `windows-icons = "0.3"` (Windows-only) |
| Tauri state | `src-tauri/src/state.rs` | `+ app_icon_cache: Arc<Mutex<IconCache>>` |
| Tauri init | `src-tauri/src/lib.rs` | Initialize cache in `AppState { ... }` literal |
| Tauri command | `src-tauri/src/commands.rs` | `+ app_icon_base64` field on `ForegroundAppContext`; populate in `get_foreground_app_context` |
| Frontend type | `src/lib/tauri.ts` | `+ app_icon_base64?: string \| null` |
| Frontend render | `src/components/tray/CurrentAppCard.tsx` | Render `<img>` OR Lucide; category-prefixed label |
| CSS | `src/index.css` | Tighten `.tray-row`; add `.tray-row-app-icon` |

---

## Task 1: Extend ProcessInfo + add foreground_process_info() trait

**Files:**
- Modify: `crates/platform/src/traits.rs:59-63`
- Modify: `crates/platform/src/traits.rs:65-86` (add new method declaration)

- [ ] **Step 1: Add `exe_path` field to ProcessInfo**

In `crates/platform/src/traits.rs`, replace the `ProcessInfo` struct (lines 59-63):

```rust
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub window_title: String,
    /// Absolute path to the executable on disk, when available.
    /// `None` on platforms that cannot resolve it cheaply or when the
    /// process is not accessible (e.g. protected by AppContainer / SIP).
    pub exe_path: Option<String>,
}
```

- [ ] **Step 2: Add `foreground_process_info()` trait method**

In `crates/platform/src/traits.rs`, inside the `ProcessQuery` trait (after `foreground_process_name` at line 84), add:

```rust
    /// Combined foreground query: returns both process name and exe path
    /// in a single call, avoiding two separate platform lookups. Default
    /// returns None; per-platform impls override for efficiency.
    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        None
    }
```

- [ ] **Step 3: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform 2>&1 | tail -30`

Expected: Compile errors ONLY on the 3 platform impls that still construct `ProcessInfo { pid, name, window_title }` without `exe_path`. Trait and types compile. (Fix in Tasks 2-4.)

- [ ] **Step 4: Commit trait change**

```bash
cd D:/SmoothScroll && git add crates/platform/src/traits.rs && git commit -m "platform: add exe_path to ProcessInfo + foreground_process_info()

Default trait impl returns None. Per-platform impls (Win/Mac/Linux)
will populate exe_path and override foreground_process_info in
follow-up tasks. All three impls must add exe_path field to their
ProcessInfo construction sites."
```

---

## Task 2: Windows — populate `exe_path` and implement `foreground_process_info()`

**Files:**
- Modify: `crates/platform/src/windows/process_query.rs:373-382` (`enumerate` callback)
- Modify: `crates/platform/src/windows/process_query.rs:184-200` (`foreground_process_name`)
- Modify: `crates/platform/src/windows/process_query.rs:237-259` (`process_name_for_pid` → add `exe_path_for_pid`)
- Modify: `crates/platform/src/windows/process_query.rs:109-121` (`foreground_process_id`)

- [ ] **Step 1: Add `exe_path_for_pid` helper**

In `crates/platform/src/windows/process_query.rs`, **replace** the existing `process_name_for_pid` function (lines 237-259) with two functions:

```rust
pub fn process_name_for_pid(pid: u32) -> Option<String> {
    exe_path_for_pid(pid).and_then(|p| {
        std::path::Path::new(&p)
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
    })
}

/// Returns the full executable path for `pid`, or None on lookup failure.
/// Reuses the limited-information token so it works for higher-integrity
/// processes too.
pub fn exe_path_for_pid(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; MAX_PATH as usize];
        let mut len: u32 = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
        let _ = CloseHandle(handle);
        if ok == 0 || len == 0 {
            return None;
        }
        Some(String::from_utf16_lossy(&buf[..len as usize]).into_owned())
    }
}
```

- [ ] **Step 2: Update `enumerate` callback to populate exe_path**

In `crates/platform/src/windows/process_query.rs`, replace the construction at line 378-382:

```rust
            acc.items.push(ProcessInfo {
                pid,
                name,
                window_title: title,
                exe_path: exe_path_for_pid(pid),
            });
```

- [ ] **Step 3: Implement `foreground_process_info`**

In `crates/platform/src/windows/process_query.rs`, add inside the `impl ProcessQuery for WindowsProcessQuery` block (after `foreground_process_name` at line 200):

```rust
    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        let self_pid = unsafe { GetCurrentProcessId() };
        let mut hwnd = unsafe { GetTopWindow(std::ptr::null_mut()) };
        while !hwnd.is_null() {
            if is_eligible_app_window(hwnd) {
                let mut pid: u32 = 0;
                unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
                if pid != 0 && pid != self_pid {
                    if let Some(name) = process_name_for_pid(pid) {
                        return Some(ProcessInfo {
                            pid,
                            name,
                            window_title: String::new(),
                            exe_path: exe_path_for_pid(pid),
                        });
                    }
                }
            }
            hwnd = unsafe { GetWindow(hwnd, GW_HWNDNEXT) };
        }
        None
    }
```

- [ ] **Step 4: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform 2>&1 | tail -30`

Expected: Clean compile for Windows target. No new warnings.

- [ ] **Step 5: Commit Windows impl**

```bash
cd D:/SmoothScroll && git add crates/platform/src/windows/process_query.rs && git commit -m "platform(windows): populate ProcessInfo.exe_path + foreground_process_info()

Uses QueryFullProcessImageNameW via PROCESS_QUERY_LIMITED_INFORMATION,
which works for higher-integrity processes without elevation. The
existing process_name_for_pid helper now derives from exe_path_for_pid
to avoid two Win32 round-trips per process."
```

---

## Task 3: macOS — populate `exe_path` and implement `foreground_process_info()`

**Files:**
- Modify: `crates/platform/src/macos/process_query.rs:30-32` (`list_visible_processes`)
- Modify: `crates/platform/src/macos/process_query.rs:34-60` (`foreground_process_name`)

- [ ] **Step 1: Implement `foreground_process_info` with bundleURL**

In `crates/platform/src/macos/process_query.rs`, replace the existing `foreground_process_name` impl (lines 34-60) and `list_visible_processes` impl (lines 30-32). First add a helper at the top of the file (after the `use` statements, before the impl block):

```rust
/// Returns the .app bundle URL of the frontmost non-self application, or None
/// when no frontmost app, the frontmost app is us, or AppKit cannot resolve
/// the bundle (e.g. background-only command-line tool).
fn frontmost_app_bundle_url() -> Option<std::path::PathBuf> {
    use objc2::msg_send;
    use objc2::msg_send_id;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSRunningApplication, NSWorkspace};
    use objc2_foundation::{NSString, NSURL};
    unsafe {
        let self_pid = std::process::id() as i32;
        let workspace = NSWorkspace::sharedWorkspace();
        let app: Option<Retained<NSRunningApplication>> =
            msg_send_id![&*workspace, frontmostApplication];
        let app = app?;
        let pid: i32 = msg_send![&*app, processIdentifier];
        if pid == self_pid {
            return None;
        }
        // bundleURL is NSURL *; .path returns NSString *. Read path then
        // release the NSURL.
        let url: Option<Retained<NSURL>> = msg_send_id![&*app, bundleURL];
        let url = url?;
        let path_ns: Option<Retained<NSString>> = msg_send_id![&*url, path];
        let path_ns = path_ns?;
        Some(std::path::PathBuf::from(path_ns.to_string()))
    }
}
```

Then replace the `foreground_process_name` and `list_visible_processes` impls with:

```rust
    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        // macOS AppKit does not expose a "list all visible apps" query the
        // way Win32 EnumWindows does. The tray panel never calls this in
        // practice (it's only invoked by settings-app profile assignment
        // which is Windows-only today). Return an empty vec rather than
        // shell out to `ps`.
        Vec::new()
    }

    fn foreground_process_name(&self) -> Option<String> {
        use objc2::msg_send;
        use objc2::msg_send_id;
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        use objc2_foundation::NSString;
        unsafe {
            let self_pid = std::process::id() as i32;
            let workspace = NSWorkspace::sharedWorkspace();
            let app: Option<Retained<NSRunningApplication>> =
                msg_send_id![&*workspace, frontmostApplication];
            let app = app?;
            let pid: i32 = msg_send![&*app, processIdentifier];
            if pid == self_pid {
                return None;
            }
            let name: Option<Retained<NSString>> = msg_send_id![&*app, localizedName];
            name.map(|n| n.to_string())
        }
    }

    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        use objc2::msg_send;
        use objc2::msg_send_id;
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        use objc2_foundation::NSString;
        unsafe {
            let self_pid = std::process::id() as i32;
            let workspace = NSWorkspace::sharedWorkspace();
            let app: Option<Retained<NSRunningApplication>> =
                msg_send_id![&*workspace, frontmostApplication];
            let app = app?;
            let pid: i32 = msg_send![&*app, processIdentifier];
            if pid == self_pid {
                return None;
            }
            let name: Option<Retained<NSString>> = msg_send_id![&*app, localizedName];
            let name = name?.to_string();
            let exe_path = frontmost_app_bundle_url();
            Some(ProcessInfo {
                pid: pid as u32,
                name,
                window_title: String::new(),
                exe_path: exe_path.and_then(|p| p.to_str().map(|s| s.to_owned())),
            })
        }
    }
```

- [ ] **Step 2: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform --target x86_64-apple-darwin 2>&1 | tail -40`

Expected: Clean compile. If cross-compile target unavailable on this Windows machine, run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform 2>&1 | tail -40` and confirm Windows path still builds (macOS code is `#[cfg]`-gated).

- [ ] **Step 3: Commit macOS impl**

```bash
cd D:/SmoothScroll && git add crates/platform/src/macos/process_query.rs && git commit -m "platform(macos): populate ProcessInfo.exe_path + foreground_process_info()

Adds frontmost_app_bundle_url() helper that reads NSRunningApplication.
bundleURL.path. foreground_process_info() returns the bundle path so
the icon extractor can resolve it via NSRunningApplication.icon."
```

---

## Task 4: Linux — populate `exe_path` and implement `foreground_process_info()`

**Files:**
- Modify: `crates/platform/src/linux/process_query.rs:321-346` (`list_visible_processes`)
- Modify: `crates/platform/src/linux/process_query.rs:348-351` (`foreground_process_name`)

- [ ] **Step 1: Add `exe_path_for_pid` helper**

In `crates/platform/src/linux/process_query.rs`, add after the existing `process_name_from_pid` function (line 125):

```rust
/// Returns the absolute path of the executable backing `pid`, read from
/// the `/proc/<pid>/exe` symlink. Returns None when the symlink is
/// unreadable (process gone, kernel-protected, or non-/proc filesystem).
pub fn exe_path_for_pid(pid: u32) -> Option<String> {
    fs::read_link(format!("/proc/{pid}/exe"))
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_owned()))
}
```

- [ ] **Step 2: Update `list_visible_processes` to populate `exe_path`**

In `crates/platform/src/linux/process_query.rs`, replace the construction at lines 337-341:

```rust
                results.push(ProcessInfo {
                    pid,
                    name,
                    window_title: title,
                    exe_path: exe_path_for_pid(pid),
                });
```

- [ ] **Step 3: Implement `foreground_process_info`**

In `crates/platform/src/linux/process_query.rs`, add inside the `impl ProcessQuery for LinuxProcessQuery` block (after `foreground_process_name` at line 351):

```rust
    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        let pid = self.foreground_process_id()?;
        let name = process_name_from_pid(pid)?;
        let exe_path = exe_path_for_pid(pid);
        Some(ProcessInfo {
            pid,
            name,
            window_title: String::new(),
            exe_path,
        })
    }
```

- [ ] **Step 4: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform 2>&1 | tail -30`

Expected: Clean compile on all 3 platforms (Windows cfg-gates macOS code; macOS cfg-gates Windows code; Linux code is unconditioned in the file).

- [ ] **Step 5: Commit Linux impl**

```bash
cd D:/SmoothScroll && git add crates/platform/src/linux/process_query.rs && git commit -m "platform(linux): populate ProcessInfo.exe_path + foreground_process_info()

Reads /proc/<pid>/exe symlink for full exe path. Linux extractor in
crates/platform/src/icon.rs returns None (XDG icon theme resolution
is non-trivial); frontend falls back to Lucide icon."
```

---

## Task 5: Add `windows-icons` dependency to platform crate

**Files:**
- Modify: `crates/platform/Cargo.toml:18-31`

- [ ] **Step 1: Add `windows-icons` to Cargo.toml**

In `crates/platform/Cargo.toml`, add a new dependency block AFTER the existing `[target.'cfg(windows)'.dependencies]` block (after line 35):

```toml
[target.'cfg(windows)'.dependencies.windows-icons]
version = "0.3"
```

- [ ] **Step 2: Run cargo fetch + check**

Run: `cd D:/SmoothScroll && cargo fetch -p smoothscroll_platform 2>&1 | tail -10 && cargo check -p smoothscroll_platform 2>&1 | tail -20`

Expected: `windows-icons` downloads and crate still compiles.

- [ ] **Step 3: Commit dep**

```bash
cd D:/SmoothScroll && git add crates/platform/Cargo.toml && git commit -m "platform(windows): add windows-icons 0.3 dependency

Used by icon.rs to extract icons from .exe/.dll paths as base64-encoded
PNGs. Pure Rust, no C deps, ~16KB crate size."
```

---

## Task 6: Create `icon.rs` module with extractor + cache

**Files:**
- Create: `crates/platform/src/icon.rs`
- Modify: `crates/platform/src/lib.rs:2-13` (add `pub mod icon;`)

- [ ] **Step 1: Create the icon module**

Create file `crates/platform/src/icon.rs` with the following content:

```rust
//! Cross-platform extractor for foreground-app icons + small in-memory cache.
//!
//! The cache keeps a bounded number of (pid → base64 PNG) entries so that
//! rapid foreground switches across many apps do not exhaust memory and the
//! second foreground visit to the same app pays zero extraction cost.
//!
//! Per-platform branches:
//! - Windows: `windows-icons` crate → base64 PNG straight from .exe resources.
//! - macOS: NSRunningApplication.icon → render to NSBitmapImageRep → base64.
//! - Linux: returns None. XDG icon-theme resolution is non-trivial and was
//!   intentionally deferred; the frontend falls back to its Lucide icon.

use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

/// Cache cap. LRU eviction when full. 32 is plenty for a normal user's
/// app-switching patterns and bounds memory at ~32 × ~10 KB ≈ 320 KB
/// worst case.
const CACHE_CAP: usize = 32;

#[derive(Clone)]
struct CacheEntry {
    base64: String,
    last_used: Instant,
}

/// Thread-safe LRU cache. Caller clones the base64 string out before
/// returning so the lock is held only for the lookup/insert.
pub struct IconCache {
    entries: Mutex<HashMap<u32, CacheEntry>>,
}

impl Default for IconCache {
    fn default() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }
}

impl IconCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Look up `pid` in the cache. On hit, refresh last_used (LRU) and
    /// return a clone. On miss, extract via `extract_for_exe`, insert,
    /// evict if over cap, and return.
    pub fn get_or_extract(&self, pid: u32, exe_path: Option<&Path>) -> Option<String> {
        if let Some(cached) = self.cached(pid) {
            return Some(cached);
        }
        let path = exe_path?;
        let base64 = extract_for_exe(path)?;
        self.insert(pid, base64.clone());
        Some(base64)
    }

    fn cached(&self, pid: u32) -> Option<String> {
        let mut map = self.entries.lock();
        let entry = map.get_mut(&pid)?;
        entry.last_used = Instant::now();
        Some(entry.base64.clone())
    }

    fn insert(&self, pid: u32, base64: String) {
        let mut map = self.entries.lock();
        map.insert(
            pid,
            CacheEntry {
                base64,
                last_used: Instant::now(),
            },
        );
        if map.len() > CACHE_CAP {
            // Evict the entry with the smallest last_used timestamp.
            if let Some((victim_pid, _)) = map
                .iter()
                .min_by_key(|(_, e)| e.last_used)
                .map(|(k, v)| (*k, v.last_used))
            {
                map.remove(&victim_pid);
            }
        }
    }
}

/// Platform-dispatched extractor. Returns base64-encoded PNG bytes
/// (no `data:` prefix), suitable for embedding into a `data:image/png;base64,…`
/// URL on the frontend.
pub fn extract_for_exe(exe_path: &Path) -> Option<String> {
    let path = exe_path.to_str()?;
    #[cfg(windows)]
    {
        return extract_windows(Path::new(path));
    }
    #[cfg(target_os = "macos")]
    {
        let _ = path;
        return extract_macos(exe_path);
    }
    #[cfg(target_os = "linux")]
    {
        let _ = path;
        return None;
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        None
    }
}

#[cfg(windows)]
fn extract_windows(path: &Path) -> Option<String> {
    use windows_icons::get_icon_base64_by_path;
    let raw = get_icon_base64_by_path(path.to_str()?).ok()?;
    // windows-icons may include a `data:image/png;base64,` prefix; strip it
    // so the frontend can compose the data URL itself.
    Some(strip_data_url_prefix(&raw))
}

#[cfg(target_os = "macos")]
fn extract_macos(bundle_path: &Path) -> Option<String> {
    use objc2::msg_send_id;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage, NSRunningApplication};
    use objc2_foundation::NSString;
    unsafe {
        // Resolve the .app bundle to a running application so AppKit loads
        // the icon from the bundle's Info.plist + .icns. NSRunningApplication
        // matches by bundle URL.
        let url_str = bundle_path.to_str()?;
        let ns_path = NSString::from_str(url_str);
        let url: Option<Retained<objc2_foundation::NSURL>> = msg_send_id![
            objc2::class!(NSURL),
            fileURLWithPath: &*ns_path
        ];
        let url = url?;
        let bundle_id = bundle_path
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.strip_suffix(".app"))
            .map(|s| s.to_string());
        // bundleIdentifier is more reliable than file_name for matching. Read
        // it from the bundle via NSBundle.
        let apps: Retained<objc2_foundation::NSArray<NSRunningApplication>> = if let Some(bid) = &bundle_id {
            let bid_ns = NSString::from_str(bid);
            NSRunningApplication::runningApplicationsWithBundleIdentifier(&bid_ns)
        } else {
            // Fallback: cannot match without bundle identifier.
            return None;
        };
        let app = apps.first_object()?;
        let image: Option<Retained<NSImage>> = msg_send_id![&*app, icon];
        let image = image?;
        let rep: Option<Retained<NSBitmapImageRep>> = msg_send_id![
            &*image,
            bitmapImageRepForCachingDisplayIn: std::ptr::null::<objc2_foundation::NSRect>()
        ];
        let rep = rep?;
        let _ = &url; // keep url alive in this scope
        let _: () = msg_send_id![&*image, cacheDisplayIn: &*rep];
        // NSBitmapImageFileTypePNG is an NSUInteger constant (4). Pass as u64.
        let props: *const std::ffi::c_void = std::ptr::null();
        let data: Option<Retained<objc2_foundation::NSData>> = msg_send_id![
            &*rep,
            representationUsingType: NSBitmapImageFileTypePNG as u64,
            properties: props
        ];
        let data = data?;
        let bytes: *const u8 = msg_send_id![&*data, bytes];
        let len: usize = msg_send_id![&*data, length];
        if bytes.is_null() || len == 0 {
            return None;
        }
        let slice = std::slice::from_raw_parts(bytes, len);
        Some(base64_encode(slice))
    }
}

fn strip_data_url_prefix(raw: &str) -> String {
    if let Some(idx) = raw.find(",") {
        if raw[..idx].starts_with("data:") {
            return raw[idx + 1..].to_string();
        }
    }
    raw.to_string()
}

/// Inline base64 encoder to avoid pulling in the `base64` crate for one
/// feature. PNG payloads are typically < 16 KB; encode/decode perf is
/// not on the hot path (called once per foreground switch).
fn base64_encode(bytes: &[u8]) -> String {
    const ALPHA: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        let b2 = bytes[i + 2];
        out.push(ALPHA[(b0 >> 2) as usize] as char);
        out.push(ALPHA[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        out.push(ALPHA[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        out.push(ALPHA[(b2 & 0x3f) as usize] as char);
        i += 3;
    }
    let rem = bytes.len() - i;
    if rem == 1 {
        let b0 = bytes[i];
        out.push(ALPHA[(b0 >> 2) as usize] as char);
        out.push(ALPHA[((b0 & 0x03) << 4) as usize] as char);
        out.push('=');
        out.push('=');
    } else if rem == 2 {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        out.push(ALPHA[(b0 >> 2) as usize] as char);
        out.push(ALPHA[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        out.push(ALPHA[((b1 & 0x0f) << 2) as usize] as char);
        out.push('=');
    }
    out
}

/// Returns the user's home directory icon for the foreground "Finder" / "Explorer"
/// pseudo-app where applicable. Currently unused but kept as a stub for
/// future shell-icon support. Returns None.
pub fn extract_for_bundle(_bundle_path: &PathBuf) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_hit_returns_same_value() {
        let cache = IconCache::new();
        cache.insert(42, "fake-b64".to_string());
        let got = cache.get_or_extract(42, None);
        assert_eq!(got.as_deref(), Some("fake-b64"));
    }

    #[test]
    fn cache_miss_with_no_path_returns_none() {
        let cache = IconCache::new();
        let got = cache.get_or_extract(99, None);
        assert_eq!(got, None);
    }

    #[test]
    fn cache_eviction_when_over_cap() {
        let cache = IconCache::new();
        for pid in 0..(CACHE_CAP + 5) as u32 {
            cache.insert(pid, format!("b64-{pid}"));
        }
        let mut map = cache.entries.lock();
        assert!(map.len() <= CACHE_CAP);
    }

    #[test]
    fn base64_encode_known_vector() {
        // RFC 4648 §10: "foobar" → "Zm9vYmFy"
        let got = base64_encode(b"foobar");
        assert_eq!(got, "Zm9vYmFy");
    }

    #[test]
    fn strip_data_url_prefix_keeps_pure_b64() {
        assert_eq!(strip_data_url_prefix("Zm9vYmFy"), "Zm9vYmFy");
        assert_eq!(
            strip_data_url_prefix("data:image/png;base64,Zm9vYmFy"),
            "Zm9vYmFy"
        );
    }
}
```

- [ ] **Step 2: Register module in `lib.rs`**

In `crates/platform/src/lib.rs`, add after `pub mod types;` (line 4):

```rust
pub mod icon;
```

- [ ] **Step 3: Run cargo test for icon module**

Run: `cd D:/SmoothScroll && cargo test -p smoothscroll_platform --lib icon 2>&1 | tail -40`

Expected: 5 unit tests pass (cache_hit, cache_miss, eviction, base64, strip).

- [ ] **Step 4: Run cargo check across all targets**

Run: `cd D:/SmoothScroll && cargo check --workspace --all-targets 2>&1 | tail -40`

Expected: Clean compile. Warnings allowed for unused variables in the macOS branch (path is unused when the Windows branch returns first).

- [ ] **Step 5: Commit icon module**

```bash
cd D:/SmoothScroll && git add crates/platform/src/icon.rs crates/platform/src/lib.rs && git commit -m "platform: add icon extractor module + IconCache (32-entry LRU)

Cross-platform extractor: Windows uses windows-icons; macOS uses
NSRunningApplication.icon rendered to PNG via NSBitmapImageRep;
Linux returns None. IconCache key is pid; LRU evicts oldest last_used
when size exceeds 32. Five unit tests cover cache hit/miss, eviction,
base64 encode, and data URL prefix stripping."
```

---

## Task 7: Wire `IconCache` into `AppState`

**Files:**
- Modify: `src-tauri/src/state.rs:29-64`
- Modify: `src-tauri/src/lib.rs:107-130` (the `AppState { ... }` literal)

- [ ] **Step 1: Add `app_icon_cache` field to AppState**

In `src-tauri/src/state.rs`, add to the imports at line 7:

```rust
use smoothscroll_platform::icon::IconCache;
```

Then add a new field to the `AppState` struct (after `last_foreground_at_tray_open` at line 62):

```rust
    /// In-memory cache mapping foreground process pid → base64-encoded PNG
    /// of that app's icon. Used by `get_foreground_app_context` to populate
    /// the tray panel row with a real app icon.
    pub app_icon_cache: Arc<Mutex<IconCache>>,
```

- [ ] **Step 2: Initialize cache in `lib.rs`**

In `src-tauri/src/lib.rs`, add to imports (after `use parking_lot::{Mutex, RwLock};` at line 20):

```rust
use smoothscroll_platform::icon::IconCache;
```

In the `AppState { ... }` literal (around line 107-130), add the new field initialization (anywhere inside the struct literal):

```rust
        app_icon_cache: Arc::new(Mutex::new(IconCache::new())),
```

- [ ] **Step 3: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check --workspace --all-targets 2>&1 | tail -30`

Expected: Clean compile.

- [ ] **Step 4: Commit wiring**

```bash
cd D:/SmoothScroll && git add src-tauri/src/state.rs src-tauri/src/lib.rs && git commit -m "src-tauri: wire IconCache into AppState

New Arc<Mutex<IconCache>> field initialized to default in lib.rs.
No behavior change yet; population comes in Task 8."
```

---

## Task 8: Populate `app_icon_base64` in `ForegroundAppContext`

**Files:**
- Modify: `src-tauri/src/commands.rs:730-737` (`ForegroundAppContext` struct)
- Modify: `src-tauri/src/commands.rs:743-772` (`get_foreground_app_context` impl)

- [ ] **Step 1: Add `app_icon_base64` field**

In `src-tauri/src/commands.rs`, replace the `ForegroundAppContext` struct (lines 730-737) with:

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct ForegroundAppContext {
    pub process_name: Option<String>,
    pub suggested_category: Option<smoothscroll_core::app_categories::AppCategory>,
    pub suggested_category_label: Option<String>,
    pub current_profile_id: Option<String>,
    pub is_excluded: bool,
    /// Base64-encoded PNG of the foreground app's icon (no `data:` prefix).
    /// `None` when icon extraction fails or the platform does not support it
    /// (Linux); the frontend falls back to its Lucide icon in that case.
    pub app_icon_base64: Option<String>,
}
```

- [ ] **Step 2: Update both struct construction sites**

In `src-tauri/src/commands.rs`, the early-return inside `get_foreground_app_context` (lines 751-757) needs the new field. Replace that block with:

```rust
    let Some(name) = process_name else {
        return ForegroundAppContext {
            process_name: None,
            suggested_category: None,
            suggested_category_label: None,
            current_profile_id: None,
            is_excluded: false,
            app_icon_base64: None,
        };
    };
```

Then replace the final construction (lines 765-771) with:

```rust
    ForegroundAppContext {
        process_name: Some(name.clone()),
        suggested_category: Some(category),
        suggested_category_label: Some(category.label().to_string()),
        current_profile_id,
        is_excluded,
        app_icon_base64: extract_icon_for_foreground(state, &name),
    }
```

- [ ] **Step 3: Add `extract_icon_for_foreground` helper**

In `src-tauri/src/commands.rs`, add immediately above `get_foreground_app_context` (above line 743):

```rust
/// Looks up the foreground app's pid + exe_path via the ProcessQuery impl
/// and consults the icon cache. Returns None when the platform does not
/// implement foreground_process_info, the lookup fails, or the cache
/// extractor returns None (Linux).
fn extract_icon_for_foreground(state: &State<'_, Arc<AppState>>, name: &str) -> Option<String> {
    let info = state.processes.foreground_process_info()?;
    // Defensive: only honor the icon if the info matches the process we
    // actually resolved by name. Misalignment means a stale snapshot.
    if !info.name.eq_ignore_ascii_case(name) {
        return None;
    }
    let cache = state.app_icon_cache.lock();
    cache.get_or_extract(info.pid, info.exe_path.as_deref())
}
```

- [ ] **Step 4: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check --workspace --all-targets 2>&1 | tail -30`

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
cd D:/SmoothScroll && git add src-tauri/src/commands.rs && git commit -m "src-tauri: populate ForegroundAppContext.app_icon_base64

Adds the new field; extract_icon_for_foreground helper consults the
cache after verifying ProcessQuery name matches the resolved process
name (defensive against stale foreground snapshots)."
```

---

## Task 9: Extend frontend type + render real icon + category-prefixed label

**Files:**
- Modify: `src/lib/tauri.ts:112-118`
- Modify: `src/components/tray/CurrentAppCard.tsx`

- [ ] **Step 1: Add `app_icon_base64` to TS type**

In `src/lib/tauri.ts`, replace the `ForegroundAppContext` interface (lines 112-118) with:

```typescript
export interface ForegroundAppContext {
  process_name: string | null;
  suggested_category: AppCategory | null;
  suggested_category_label: string | null;
  current_profile_id: string | null;
  is_excluded: boolean;
  /** Base64 PNG (no data: prefix). Null when extraction fails or unsupported. */
  app_icon_base64?: string | null;
}
```

- [ ] **Step 2: Update `CurrentAppCard.tsx` rendering**

In `src/components/tray/CurrentAppCard.tsx`, replace the entire return JSX block (lines 91-99) with:

```tsx
  const labelPrefix = ctx.suggested_category_label
    ? `${ctx.suggested_category_label}: `
    : "";

  return (
    <div className="tray-row">
      <span className="tray-row-icon">
        {ctx.app_icon_base64 ? (
          <img
            src={`data:image/png;base64,${ctx.app_icon_base64}`}
            className="tray-row-app-icon"
            alt=""
            draggable={false}
          />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>
      <span className="tray-row-label">{labelPrefix}{displayName}</span>
      <Switch checked={!isDisabled} onCheckedChange={handleToggle} />
    </div>
  );
```

- [ ] **Step 3: Run frontend type check + lint**

Run: `cd D:/SmoothScroll && pnpm exec tsc --noEmit 2>&1 | tail -30`

Expected: Clean compile, no TS errors.

- [ ] **Step 4: Commit frontend changes**

```bash
cd D:/SmoothScroll && git add src/lib/tauri.ts src/components/tray/CurrentAppCard.tsx && git commit -m "tray: render real app icon (or Lucide fallback) + category-prefixed label

CurrentAppCard now shows '<Category>: <AppName>' (e.g. 'IDE: Visual
Studio Code') instead of just the prettified process name. When
ctx.app_icon_base64 is present, renders an inline <img data:...>;
otherwise falls back to the existing Lucide category icon."
```

---

## Task 10: Tighten `.tray-row` spacing + add `.tray-row-app-icon` styles

**Files:**
- Modify: `src/index.css:623-651`

- [ ] **Step 1: Update `.tray-row` and `.tray-row-icon` rules**

In `src/index.css`, replace the block at lines 623-651 with:

```css
.tray-row {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 0 6px;
  min-height: 36px;
  padding: 0 10px;
  font-size: 0.84rem;
  font-weight: 500;
}
```

Keep the rest of the file unchanged (`.tray-row:hover`, `.tray-row-icon`, `.tray-row-label`, etc.). Then ADD a new rule right after `.tray-row-label` (after line 651):

```css
.tray-row-app-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 2: Search for platform-specific tray-row overrides**

Run: `cd D:/SmoothScroll && grep -nE 'tray-row|tray-row-icon' src/index.css`

If a `body[data-platform="mac"]` or `body[data-platform="linux"]` block contains a `.tray-row` rule with `grid-template-columns: 28px 1fr auto`, `gap: 0 10px`, or `padding: 0 12px`, replace those values with `20px 1fr auto`, `gap: 0 6px`, `padding: 0 10px` respectively to keep the new tight spacing consistent. If no override exists, leave them.

- [ ] **Step 3: Verify Vite build**

Run: `cd D:/SmoothScroll && pnpm run build 2>&1 | tail -20`

Expected: Vite build succeeds, no CSS errors.

- [ ] **Step 4: Commit CSS changes**

```bash
cd D:/SmoothScroll && git add src/index.css && git commit -m "tray: tighten .tray-row spacing + add .tray-row-app-icon style

Grid shrinks 28→20px icon column; gap 10→6px; padding 12→10px.
App-icon image renders at 16×16 with object-fit: contain for clean
fallback when extracted PNG is non-square."
```

---

## Task 11: Pre-build verification

**Files:** None (read-only checks).

- [ ] **Step 1: Run full cargo build on Windows target**

Run: `cd D:/SmoothScroll && cargo build --workspace --all-targets 2>&1 | tail -40`

Expected: Zero errors. Warnings OK.

- [ ] **Step 2: Run all Rust tests**

Run: `cd D:/SmoothScroll && cargo test --workspace 2>&1 | tail -50`

Expected: All tests pass (including 5 new icon tests).

- [ ] **Step 3: Run frontend type-check + lint**

Run: `cd D:/SmoothScroll && pnpm exec tsc --noEmit 2>&1 | tail -10`

Expected: Zero errors.

- [ ] **Step 4: Fix any failures and commit fixes**

If any step above fails, write the minimal fix in a single commit:

```bash
cd D:/SmoothScroll && git add -A && git commit -m "fix: address pre-build verification failures

[describe what was fixed]"
```

---

## Task 12: Local Windows Tauri build + smoke test

Per `feedback-build-locally-before-push.md`, ship to local exe before any push.

**Files:** None (build only).

- [ ] **Step 1: Build WASM if needed**

Run: `cd D:/SmoothScroll && pnpm run build:wasm 2>&1 | tail -10`

Expected: Either no-op (already built) or builds cleanly.

- [ ] **Step 2: Build Tauri release bundle**

Run: `cd D:/SmoothScroll/src-tauri && npx tauri build 2>&1 | tail -40`

Expected: Bundle produced at `src-tauri/target/release/bundle/nsis/SmoothScroll_<version>_x64-setup.exe` and `bundle/msi/*.msi`.

- [ ] **Step 3: Verify bundle paths exist**

Run: `ls "D:/SmoothScroll/src-tauri/target/release/bundle/nsis/" 2>&1 && ls "D:/SmoothScroll/src-tauri/target/release/bundle/msi/" 2>&1`

Expected: Both `.exe` and `.msi` listed.

- [ ] **Step 4: Hand artifact to Honey for testing**

Report in chat:
- Path: `D:/SmoothScroll/src-tauri/target/release/bundle/nsis/SmoothScroll_<version>_x64-setup.exe`
- Path: `D:/SmoothScroll/src-tauri/target/release/bundle/msi/SmoothScroll_<version>_x64_en-US.msi`
- Manual test checklist:
  1. Install via NSIS .exe
  2. Open tray panel — confirm tighter icon→label spacing
  3. Confirm category prefix in label (e.g. `IDE: Visual Studio Code`)
  4. Switch foreground between Chrome, VS Code, Notepad — confirm real app icons appear
  5. Switch to a process with no .exe icon (rare) — confirm Lucide fallback
  6. Re-open same app within 5s — confirm cached icon (no perceptible delay)
- Do NOT push to master until Honey confirms the artifact works.

---

## Self-Review

**1. Spec coverage**:
- AC-1 (real icon Win/Mac): Tasks 2, 3, 6 ✓
- AC-2 (Lucide fallback): Task 9 (`ctx.app_icon_base64 ? <img> : <Icon />`) ✓
- AC-3 (label format): Task 9 ✓
- AC-4 (spacing 18→6px): Task 10 (28→20 col, 10→6 gap) ✓
- AC-5 (cache hit): Task 6 (`IconCache::cached` updates last_used) ✓
- AC-6 (32-entry cap): Task 6 (`CACHE_CAP = 32`, eviction in `insert`) ✓
- AC-7 (no regressions): Task 10 preserves platform-specific overrides (Step 2 audit)
- AC-8 (no Linux deps): Task 5 gates `windows-icons` behind `cfg(windows)`
- AC-9 (build green): Tasks 11, 12 ✓

**2. Placeholder scan**: No "TBD"/"TODO"/"fill in" — all steps include complete code.

**3. Type consistency**:
- `ProcessInfo { pid, name, window_title, exe_path }` — consistent across Tasks 1, 2, 3, 4.
- `IconCache::get_or_extract(pid, exe_path)` — consistent between Task 6 (def) and Task 8 (call site).
- `app_icon_base64: Option<String>` — consistent between Task 8 (Rust) and Task 9 (TS).
- `extract_icon_for_foreground` helper signature matches Task 8 call site.