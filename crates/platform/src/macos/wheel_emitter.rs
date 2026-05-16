//! Synthesises scroll wheel events via `CGEventCreateScrollWheelEvent2` and
//! posts them to `kCGHIDEventTap` so they bubble through the system as if
//! they came from physical hardware.

#![cfg(target_os = "macos")]

use crate::traits::WheelEmitter;
use crate::types::{PlatformError, Result};
use core_graphics::event::{CGEvent, CGEventTapLocation, ScrollEventUnit};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

pub struct MacosWheelEmitter;

impl WheelEmitter for MacosWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }
        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| PlatformError::Os("CGEventSource::new failed".into()))?;

        // CGEventCreateScrollWheelEvent2: wheelCount=2 → axis 1 = vertical, axis 2 = horizontal
        // Sign convention matches our engine: positive vertical = scroll up.
        let event = CGEvent::new_scroll_event(
            source,
            ScrollEventUnit::PIXEL,
            2,
            vertical_units,
            horizontal_units,
            0,
        )
        .map_err(|_| PlatformError::Os("CGEvent::new_scroll_event failed".into()))?;

        event.post(CGEventTapLocation::HID);
        Ok(())
    }
}
