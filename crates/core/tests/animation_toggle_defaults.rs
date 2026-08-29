use smoothscroll_core::settings::AppSettings;

#[test]
fn animation_time_toggle_defaults_to_off_for_new_and_legacy_settings() {
    let defaults = serde_json::to_value(AppSettings::default()).unwrap();
    assert_eq!(
        defaults
            .get("animation_time_enabled")
            .and_then(serde_json::Value::as_bool),
        Some(false)
    );

    let legacy: AppSettings = serde_json::from_str(r#"{"enabled":true}"#).unwrap();
    let legacy_json = serde_json::to_value(legacy).unwrap();
    assert_eq!(
        legacy_json
            .get("animation_time_enabled")
            .and_then(serde_json::Value::as_bool),
        Some(false)
    );
}

#[test]
fn smooth_horizontal_scrolling_defaults_to_off() {
    let defaults = serde_json::to_value(AppSettings::default()).unwrap();
    assert_eq!(
        defaults
            .get("horizontal_smoothness")
            .and_then(serde_json::Value::as_bool),
        Some(false)
    );
}
