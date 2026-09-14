//! Tests for the settings persistor worker.
//! Every test binds the persistor to a unique temp path — the worker never
//! touches the developer's real settings.json.

use std::path::PathBuf;
use std::time::Duration;

fn unique_temp_path(prefix: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "{prefix}-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

fn make_test_settings(step: i32, enabled: bool) -> smoothscroll_core::settings::AppSettings {
    smoothscroll_core::settings::AppSettings {
        step_size_px: step,
        enabled,
        ..Default::default()
    }
}

fn read_step_size(path: &std::path::Path) -> Option<i32> {
    let raw: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(path).ok()?,
    )
    .ok()?;
    raw.get("step_size_px")?.as_i64().map(|v| v as i32)
}

#[test]
fn test_debounce_collapse_multiple_rapid_saves() {
    let path = unique_temp_path("ss-persistor-debounce");
    let persistor = crate::settings_persistor::SettingsPersistor::spawn_with_path(path.clone());

    // Submit 5 saves with 50ms spacing (less than debounce) — only the last
    // snapshot may land on disk.
    for i in 0..5 {
        persistor.submit(make_test_settings(i * 10, true));
        std::thread::sleep(Duration::from_millis(50));
    }

    std::thread::sleep(Duration::from_millis(500));
    persistor.shutdown();

    assert_eq!(read_step_size(&path), Some(40));
    let _ = std::fs::remove_file(&path);
}

#[test]
fn test_settings_persistor_shutdown_flushes_pending() {
    let path = unique_temp_path("ss-persistor-flush");
    let persistor = crate::settings_persistor::SettingsPersistor::spawn_with_path(path.clone());

    persistor.submit(make_test_settings(42, false));

    // Shutdown immediately — the pending write must be flushed, not dropped.
    persistor.shutdown();

    assert_eq!(read_step_size(&path), Some(42));
    let _ = std::fs::remove_file(&path);
}

#[test]
fn test_submit_then_drop_flushes_pending() {
    let path = unique_temp_path("ss-persistor-drop");
    let persistor = crate::settings_persistor::SettingsPersistor::spawn_with_path(path.clone());

    persistor.submit(make_test_settings(100, true));
    // Drop triggers shutdown, which drains the pending write.
    drop(persistor);
    std::thread::sleep(Duration::from_millis(50));

    assert_eq!(read_step_size(&path), Some(100));
    let _ = std::fs::remove_file(&path);
}

#[test]
fn test_shutdown_without_submit_is_noop() {
    let path = unique_temp_path("ss-persistor-noop");
    let persistor = crate::settings_persistor::SettingsPersistor::spawn_with_path(path.clone());
    persistor.shutdown();

    assert!(read_step_size(&path).is_none());
    let _ = std::fs::remove_file(&path);
}
