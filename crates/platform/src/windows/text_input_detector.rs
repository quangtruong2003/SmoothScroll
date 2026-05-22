#![cfg(windows)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, UIA_DocumentControlTypeId, UIA_EditControlTypeId,
};

const CACHE_TTL: Duration = Duration::from_millis(50);

static CACHE: Mutex<Option<(Instant, bool)>> = Mutex::new(None);

pub fn is_focus_in_text_input() -> bool {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if let Some((ts, val)) = *guard {
        if ts.elapsed() < CACHE_TTL {
            return val;
        }
    }
    let result = query_uia_focus();
    *guard = Some((Instant::now(), result));
    result
}

fn query_uia_focus() -> bool {
    unsafe {
        // COM init is idempotent per thread; ignore return value.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let automation: IUIAutomation =
            match CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) {
                Ok(a) => a,
                Err(_) => return false,
            };

        let element = match automation.GetFocusedElement() {
            Ok(e) => e,
            Err(_) => return false,
        };

        let control_type = match element.CurrentControlType() {
            Ok(ct) => ct,
            Err(_) => return false,
        };

        // UIA_EditControlTypeId = 50004: <input>, native Edit controls, browser address bars
        // UIA_DocumentControlTypeId = 50030: <textarea>, contenteditable, rich editors
        control_type == UIA_EditControlTypeId || control_type == UIA_DocumentControlTypeId
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn does_not_panic() {
        // UIA may not be available in headless CI; we just verify no panic.
        let _ = is_focus_in_text_input();
    }

    #[test]
    fn cache_is_populated_after_first_call() {
        {
            let mut guard = CACHE.lock().unwrap();
            *guard = None;
        }
        let _ = is_focus_in_text_input();
        let guard = CACHE.lock().unwrap();
        assert!(guard.is_some(), "cache should be populated after first call");
    }
}
