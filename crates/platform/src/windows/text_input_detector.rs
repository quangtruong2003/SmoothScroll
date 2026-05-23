#![cfg(windows)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

use windows::core::Interface;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTextEditPattern,
    IUIAutomationValuePattern, UIA_CustomControlTypeId, UIA_DocumentControlTypeId,
    UIA_EditControlTypeId, UIA_TextEditPatternId, UIA_ValuePatternId,
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
        // rich editors, Chromium/Electron textareas) and read-only browser page
        // bodies. Treat as text input when either ValuePattern reports
        // not-read-only OR TextEditPattern is supported.
        if control_type == UIA_DocumentControlTypeId {
            return is_document_editable(&element);
        }
        // Custom controls cover Discord/Slack/Telegram/Signal chat inputs and
        // some IDEs (JetBrains). They expose neither Edit nor Document, so
        // require an explicit editable signal (TextEditPattern or
        // ValuePattern not-read-only) before claiming text input.
        if control_type == UIA_CustomControlTypeId {
            return is_custom_editable(&element);
        }
        false
    }
}

unsafe fn is_document_editable(element: &IUIAutomationElement) -> bool {
    // ValuePattern path: Word, native rich editors, some Edit-like controls.
    if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_ValuePatternId) {
        if let Ok(value_pattern) = pattern_obj.cast::<IUIAutomationValuePattern>() {
            if let Ok(ro) = value_pattern.CurrentIsReadOnly() {
                if !ro.as_bool() {
                    return true;
                }
            }
        }
    }
    // TextEditPattern path: Chromium contenteditable, Monaco, Electron rich
    // inputs. TextEdit is only exposed by editable text surfaces, so its
    // presence alone is sufficient.
    if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_TextEditPatternId) {
        if pattern_obj.cast::<IUIAutomationTextEditPattern>().is_ok() {
            return true;
        }
    }
    // FrameworkId heuristic: Word/PowerPoint/Excel/Outlook expose Document
    // controls without TextEditPattern or ValuePattern. Chromium-family
    // frameworks (Chrome, Edge, WebView2) use Document for both editable
    // surfaces (caught above by TextEditPattern) AND read-only page bodies,
    // so they must stay strict. Everything else (Win32, Office, WPF, UWP)
    // defaults to editable since Document there means a real text surface.
    if let Ok(framework) = element.CurrentFrameworkId() {
        let s = framework.to_string();
        if !s.is_empty() && !is_chromium_framework(&s) {
            return true;
        }
    }
    false
}

fn is_chromium_framework(framework_id: &str) -> bool {
    const CHROMIUM_FRAMEWORKS: &[&str] = &["Chrome", "Edge", "WebView2"];
    CHROMIUM_FRAMEWORKS
        .iter()
        .any(|f| framework_id.eq_ignore_ascii_case(f))
}

unsafe fn is_custom_editable(element: &IUIAutomationElement) -> bool {
    // Discord/Slack/Telegram/Signal/JetBrains expose Custom controls. Unlike
    // Document, Custom has no read-only-page-body false-positive risk: if a
    // Custom element advertises TextEdit or a writable value, it really is
    // text input. Skip the FrameworkId fallback here — without an editable
    // pattern, treat as not-text-input.
    if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_ValuePatternId) {
        if let Ok(value_pattern) = pattern_obj.cast::<IUIAutomationValuePattern>() {
            if let Ok(ro) = value_pattern.CurrentIsReadOnly() {
                if !ro.as_bool() {
                    return true;
                }
            }
        }
    }
    if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_TextEditPatternId) {
        if pattern_obj.cast::<IUIAutomationTextEditPattern>().is_ok() {
            return true;
        }
    }
    false
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
    fn chromium_frameworks_are_recognised() {
        assert!(is_chromium_framework("Chrome"));
        assert!(is_chromium_framework("chrome"));
        assert!(is_chromium_framework("Edge"));
        assert!(is_chromium_framework("WebView2"));
        assert!(is_chromium_framework("webview2"));
    }

    #[test]
    fn non_chromium_frameworks_are_rejected() {
        assert!(!is_chromium_framework("Win32"));
        assert!(!is_chromium_framework("WPF"));
        assert!(!is_chromium_framework("XAML"));
        assert!(!is_chromium_framework("DirectUI"));
        assert!(!is_chromium_framework(""));
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
