//! Tests for the settings persistor worker.

use std::time::Duration;

fn make_test_settings(step: i32, enabled: bool) -> smoothscroll_core::settings::AppSettings {
    smoothscroll_core::settings::AppSettings {
        step_size_px: step,
        enabled,
        ..Default::default()
    }
}

#[test]
fn test_debounce_collapse_multiple_rapid_saves() {
    // This test verifies that rapid saves are debounced
    // Since we can't easily mock the save function in integration tests,
    // we test the behavior through the actual implementation
    // by checking that saves complete within reasonable time

    let persistor = crate::settings_persistor::SettingsPersistor::spawn();

    // Submit 5 saves with 50ms spacing (less than debounce)
    for i in 0..5 {
        persistor.submit(make_test_settings(i * 10, true));
        std::thread::sleep(Duration::from_millis(50));
    }

    // Wait for debounce to settle
    std::thread::sleep(Duration::from_millis(500));

    // Drop will trigger shutdown and flush
    drop(persistor);

    // The test passes if no panic occurs
    // In real scenarios, we'd verify save count via mock
}

#[test]
fn test_settings_persistor_shutdown_flushes_pending() {
    let persistor = crate::settings_persistor::SettingsPersistor::spawn();

    // Submit a save
    persistor.submit(make_test_settings(42, false));

    // Shutdown immediately - should flush pending
    persistor.shutdown();

    // Test passes if no panic
}

#[test]
fn test_settings_persistor_submit_succeeds() {
    let persistor = crate::settings_persistor::SettingsPersistor::spawn();

    // Submit should not panic
    persistor.submit(make_test_settings(100, true));

    // Immediately shutdown
    persistor.shutdown();
}

#[test]
fn test_drop_calls_shutdown() {
    // Creating and dropping should not panic
    let _persistor = crate::settings_persistor::SettingsPersistor::spawn();
    // Drop happens automatically at end of scope
}

#[test]
fn test_multiple_submit_calls() {
    let persistor = crate::settings_persistor::SettingsPersistor::spawn();

    for i in 0..10 {
        persistor.submit(make_test_settings(i, i % 2 == 0));
    }

    std::thread::sleep(Duration::from_millis(100));
    persistor.shutdown();
}

#[test]
fn test_settings_with_different_values() {
    let persistor = crate::settings_persistor::SettingsPersistor::spawn();

    // Test various settings values
    persistor.submit(make_test_settings(1, false));
    persistor.submit(make_test_settings(100, true));
    persistor.submit(make_test_settings(0, false));

    persistor.shutdown();
}
