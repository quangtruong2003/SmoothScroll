//! Keyboard scroll key mapping. Pure data + functions.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardScrollKey {
    PageUp,
    PageDown,
    Space,
    ShiftSpace,
    ArrowUp,
    ArrowDown,
}

impl KeyboardScrollKey {
    pub fn to_notches(self, pgdn_step: i32, arrow_step: i32) -> i32 {
        match self {
            Self::PageDown | Self::Space => pgdn_step,
            Self::PageUp | Self::ShiftSpace => -pgdn_step,
            Self::ArrowUp => arrow_step,    // ArrowUp = scroll down (content moves up)
            Self::ArrowDown => -arrow_step, // ArrowDown = scroll up (content moves down)
        }
    }
}

pub fn parse_key(s: &str) -> Option<KeyboardScrollKey> {
    match s {
        "PageDown" => Some(KeyboardScrollKey::PageDown),
        "PageUp" => Some(KeyboardScrollKey::PageUp),
        "Space" => Some(KeyboardScrollKey::Space),
        "ShiftSpace" => Some(KeyboardScrollKey::ShiftSpace),
        "ArrowUp" => Some(KeyboardScrollKey::ArrowUp),
        "ArrowDown" => Some(KeyboardScrollKey::ArrowDown),
        _ => None,
    }
}
