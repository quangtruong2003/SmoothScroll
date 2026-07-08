//! Cross-platform extractor for foreground-app icons + small in-memory cache.
//!
//! The cache keeps a bounded number of (pid → base64 PNG) entries so that
//! rapid foreground switches across many apps do not exhaust memory and the
//! second foreground visit to the same app pays zero extraction cost.
//!
//! Per-platform branches:
//! - Windows: `windows-icons` crate → base64 PNG straight from .exe resources.
//! - macOS: NSRunningApplication.icon → render to NSBitmapImageRep → base64.
//!   (Stubbed for now; the binding surface differs between objc2 versions.
//!   The frontend falls back to its Lucide icon, which is acceptable.)
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
            if let Some(victim_pid) = map
                .iter()
                .min_by_key(|(_, e)| e.last_used)
                .map(|(k, _)| *k)
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
    #[cfg(windows)]
    {
        return extract_windows(exe_path);
    }
    #[cfg(target_os = "macos")]
    {
        return extract_macos(exe_path);
    }
    #[cfg(target_os = "linux")]
    {
        return None;
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

#[cfg(windows)]
fn extract_windows(path: &Path) -> Option<String> {
    use windows_icons::get_icon_base64_by_path;
    let raw = get_icon_base64_by_path(path).ok()?;
    // `image_to_base64` inside windows-icons only does
    // `general_purpose::STANDARD.encode(buffer)` — no `data:` prefix. But
    // we keep the strip helper as defense against future versions.
    Some(strip_data_url_prefix(&raw))
}

// TODO: implement macOS icon extraction in follow-up.
//
// The objc2-app-kit 0.2 / objc2-foundation 0.2 binding surface doesn't
// expose high-level wrappers for `bitmapImageRepForCachingDisplayIn:`,
// `cacheDisplayIn:toRect:`, or `representationUsingType:properties:`.
// Implementing this correctly requires either:
//   (a) bumping to objc2 0.6 + matching crate versions where the
//       `NSBitmapImageRep` typed methods ship, or
//   (b) writing a small unsafe shim using `msg_send!` with the right
//       Encode bounds.
//
// Either way, this is a multi-hour task that needs an actual macOS host
// to verify. For now we return None, and the frontend's Lucide icon
// fallback covers it.
#[cfg(target_os = "macos")]
fn extract_macos(_bundle_path: &Path) -> Option<String> {
    None
}

fn strip_data_url_prefix(raw: &str) -> String {
    if let Some(idx) = raw.find(',') {
        if raw[..idx].starts_with("data:") {
            return raw[idx + 1..].to_string();
        }
    }
    raw.to_string()
}

/// Inline base64 encoder to avoid pulling in the `base64` crate for one
/// feature. PNG payloads are typically < 16 KB; encode/decode perf is
/// not on the hot path (called once per foreground switch).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
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
        let map = cache.entries.lock();
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
