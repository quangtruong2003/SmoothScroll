use smoothscroll_core::keyboard_scroll::{parse_key, KeyboardScrollKey};

#[test]
fn parse_known_keys() {
    assert_eq!(parse_key("PageDown"), Some(KeyboardScrollKey::PageDown));
    assert_eq!(parse_key("PageUp"), Some(KeyboardScrollKey::PageUp));
    assert_eq!(parse_key("Space"), Some(KeyboardScrollKey::Space));
    assert_eq!(parse_key("ShiftSpace"), Some(KeyboardScrollKey::ShiftSpace));
    assert_eq!(parse_key("ArrowDown"), Some(KeyboardScrollKey::ArrowDown));
    assert_eq!(parse_key("ArrowUp"), Some(KeyboardScrollKey::ArrowUp));
}

#[test]
fn parse_unknown_returns_none() {
    assert_eq!(parse_key("Random"), None);
    assert_eq!(parse_key(""), None);
}

#[test]
fn pgdn_returns_positive_notches() {
    assert_eq!(KeyboardScrollKey::PageDown.to_notches(5, 1), 5);
}

#[test]
fn pgup_returns_negative_notches() {
    assert_eq!(KeyboardScrollKey::PageUp.to_notches(5, 1), -5);
}

#[test]
fn arrow_uses_arrow_step() {
    assert_eq!(KeyboardScrollKey::ArrowDown.to_notches(5, 1), 1);
    assert_eq!(KeyboardScrollKey::ArrowUp.to_notches(5, 2), -2);
}

#[test]
fn space_acts_as_pgdn() {
    assert_eq!(KeyboardScrollKey::Space.to_notches(5, 1), 5);
}

#[test]
fn shift_space_acts_as_pgup() {
    assert_eq!(KeyboardScrollKey::ShiftSpace.to_notches(5, 1), -5);
}
