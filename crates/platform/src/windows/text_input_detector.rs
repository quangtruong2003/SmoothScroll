#![cfg(windows)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

use windows::core::Interface;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationValuePattern,
    UIA_DocumentControlTypeId, UIA_EditControlTypeId, UIA_ValuePatternId,
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

        // Edit controls (<input>, native Edit, address bar) are always editable.
        if control_type == UIA_EditControlTypeId {
            return true;
        }
        // Document controls span both editable surfaces (contenteditable, Word,
        // rich editors) and read-only browser page bodies. Only treat as text
        // input when ValuePattern reports the document is editable.
        if control_type == UIA_DocumentControlTypeId {
            return is_document_editable(&element);
        }
        false
    }
}

unsafe fn is_document_editable(element: &IUIAutomationElement) -> bool {
    let pattern_obj = match element.GetCurrentPattern(UIA_ValuePatternId) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let value_pattern: IUIAutomationValuePattern = match pattern_obj.cast() {
        Ok(v) => v,
        Err(_) => return false,
    };
    match value_pattern.CurrentIsReadOnly() {
        Ok(ro) => !ro.as_bool(),
        Err(_) => false,
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
