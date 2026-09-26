//! Scan for installed apps (exe name -> path) to power the Game Mode game
//! picker and chip icons. Windows: Registry App Paths + Start Menu .lnk
//! targets. Other platforms return an empty list; the frontend falls back to
//! its generic icon and manual entry.

use std::path::Path;

#[derive(Debug, Clone)]
pub struct InstalledApp {
    /// exe file name incl. extension, preserving source casing, e.g. "GTA5.exe".
    pub exe_name: String,
    /// Human label when known (Start Menu shortcut file stem).
    pub display_name: Option<String>,
    pub exe_path: std::path::PathBuf,
}

/// File name of an exe path, e.g. "GTA5.exe". None for paths without a file name.
pub fn exe_file_name(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy().trim().to_string();
    (!name.is_empty()).then_some(name)
}

/// Dedup case-insensitively by exe file name, keeping the first occurrence
/// (callers pass running-process sources first for precedence). Empty names
/// are dropped.
pub fn dedup_by_exe_name(apps: Vec<InstalledApp>) -> Vec<InstalledApp> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(apps.len());
    for app in apps {
        if app.exe_name.is_empty() {
            continue;
        }
        if seen.insert(app.exe_name.to_lowercase()) {
            out.push(app);
        }
    }
    out
}

#[cfg(windows)]
pub fn scan_installed_apps() -> Vec<InstalledApp> {
    windows_impl::scan()
}

#[cfg(not(windows))]
pub fn scan_installed_apps() -> Vec<InstalledApp> {
    Vec::new()
}

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use std::fs;
    use std::os::windows::fs::MetadataExt;
    use std::path::PathBuf;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink, SLGP_UNCPRIORITY};
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    /// std's is_symlink() does not report junctions; detect them via the
    /// reparse attribute instead.
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

    const START_MENU_REL: &str = r"Microsoft\Windows\Start Menu\Programs";
    /// Bounds so a pathological Start Menu cannot stall the picker's first open.
    const MAX_SCAN_ENTRIES: usize = 2000;
    const MAX_SCAN_DEPTH: usize = 5;

    pub fn scan() -> Vec<InstalledApp> {
        let mut apps = app_paths_entries();
        apps.extend(start_menu_entries());
        dedup_by_exe_name(apps)
    }

    /// `HKLM` App Paths (native + WOW6432Node) and `HKCU`. Values are usually
    /// absolute; REG_EXPAND_SZ strings with unexpanded `%VAR%` simply fail the
    /// is-file check and are skipped.
    fn app_paths_entries() -> Vec<InstalledApp> {
        let mut out = Vec::new();
        for (hive, sub) in [
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths"),
            (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
        ] {
            let Ok(hive_key) = RegKey::predef(hive).open_subkey_with_flags(sub, KEY_READ) else {
                continue;
            };
            for subkey_name in hive_key.enum_keys().flatten() {
                let Ok(subkey) = hive_key.open_subkey_with_flags(&subkey_name, KEY_READ) else {
                    continue;
                };
                let Ok(target) = subkey.get_value::<String, _>("") else {
                    continue;
                };
                let path = PathBuf::from(target.trim());
                if !path.is_file() {
                    continue;
                }
                out.push(InstalledApp {
                    exe_name: subkey_name,
                    display_name: None,
                    exe_path: path,
                });
            }
        }
        out
    }

    fn start_menu_entries() -> Vec<InstalledApp> {
        let mut roots = Vec::new();
        if let Ok(pd) = std::env::var("ProgramData") {
            roots.push(PathBuf::from(pd).join(START_MENU_REL));
        }
        if let Ok(ad) = std::env::var("APPDATA") {
            roots.push(PathBuf::from(ad).join(START_MENU_REL));
        }
        let mut lnk_files = Vec::new();
        for root in &roots {
            collect_lnk_files(root, 0, &mut lnk_files);
        }
        lnk_files.truncate(MAX_SCAN_ENTRIES);

        // IShellLinkW needs an initialized apartment; treat "already
        // initialized with a different model" (RPC_E_CHANGED_MODE) as usable.
        let com_initialized =
            unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() };

        let mut out = Vec::new();
        for lnk_path in lnk_files {
            let Some(target) = lnk_target(&lnk_path) else {
                continue;
            };
            if !target.is_file() {
                continue;
            }
            let Some(exe_name) = exe_file_name(&target) else {
                continue;
            };
            let display_name = lnk_path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string());
            out.push(InstalledApp {
                exe_name,
                display_name,
                exe_path: target,
            });
        }

        if com_initialized {
            unsafe { CoUninitialize() };
        }
        out
    }

    fn collect_lnk_files(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
        if depth > MAX_SCAN_DEPTH || out.len() >= MAX_SCAN_ENTRIES {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            // Skip junctions/reparse points: std's is_symlink() does not
            // report them, and a loop would recurse without bound.
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                continue;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                collect_lnk_files(&path, depth + 1, out);
            } else if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("lnk")) {
                out.push(path);
                if out.len() >= MAX_SCAN_ENTRIES {
                    return;
                }
            }
        }
    }

    /// Parses a shortcut's target path via the shell's own IShellLinkW
    /// parser. The pure-Rust `lnk` crate is NOT an option here: it unwraps
    /// on malformed input, and every release profile ships panic=abort, so
    /// one bad .lnk in the Start Menu would take the whole app down.
    fn lnk_target(path: &Path) -> Option<PathBuf> {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::Interface;

        let wide: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let link: IShellLinkW =
            unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()? };
        let persist: IPersistFile = link.cast().ok()?;
        unsafe { persist.Load(PCWSTR(wide.as_ptr()), STGM_READ).ok()? };
        let mut buf = [0u16; 260];
        let mut find = WIN32_FIND_DATAW::default();
        unsafe { link.GetPath(&mut buf, &mut find, SLGP_UNCPRIORITY.0 as u32).ok()? };
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let target = String::from_utf16_lossy(&buf[..end]);
        (!target.is_empty()).then(|| PathBuf::from(target))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn dedup_keeps_first_occurrence_case_insensitively() {
        let apps = vec![
            InstalledApp {
                exe_name: "GTA5.exe".into(),
                display_name: None,
                exe_path: PathBuf::from(r"C:\a\GTA5.exe"),
            },
            InstalledApp {
                exe_name: "gta5.exe".into(),
                display_name: Some("dup".into()),
                exe_path: PathBuf::from(r"C:\b\gta5.exe"),
            },
            InstalledApp {
                exe_name: "cs2.exe".into(),
                display_name: None,
                exe_path: PathBuf::from(r"C:\a\cs2.exe"),
            },
        ];
        let got = dedup_by_exe_name(apps);
        assert_eq!(got.len(), 2);
        assert_eq!(got[0].exe_name, "GTA5.exe");
        assert_eq!(got[0].display_name, None);
        assert_eq!(got[1].exe_name, "cs2.exe");
    }

    #[test]
    fn dedup_drops_empty_names() {
        let apps = vec![InstalledApp {
            exe_name: String::new(),
            display_name: None,
            exe_path: PathBuf::from(r"C:\a"),
        }];
        assert!(dedup_by_exe_name(apps).is_empty());
    }

    #[test]
    fn exe_file_name_returns_file_name_with_extension() {
        assert_eq!(
            exe_file_name(Path::new(r"C:\Games\Hades\Hades.exe")),
            Some("Hades.exe".to_string())
        );
        assert_eq!(exe_file_name(Path::new("cs2.exe")), Some("cs2.exe".to_string()));
        assert_eq!(exe_file_name(Path::new("")), None);
    }
}
