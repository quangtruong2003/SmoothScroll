#![cfg(target_os = "macos")]
use crate::traits::DisplayQuery;

pub struct MacosDisplayQuery;

impl DisplayQuery for MacosDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        use objc2::msg_send;
        use objc2_app_kit::NSScreen;

        unsafe {
            // NSScreen::mainScreen() returns the screen containing the menu bar.
            // On a single-display Mac, this is always the primary screen.
            let screen = NSScreen::mainScreen();

            match screen {
                Some(ref s) => {
                    // maximumFramesPerSecond returns 0 if the display's refresh
                    // rate cannot be determined (e.g., headless or VM without
                    // graphics acceleration). Fall back to 60.
                    let rate: f64 = msg_send![&**s, maximumFramesPerSecond];
                    if rate > 0.0 && rate.is_finite() {
                        rate as u32
                    } else {
                        60
                    }
                }
                None => 60, // No screen available — shouldn't happen on a real Mac
            }
        }
    }
}
