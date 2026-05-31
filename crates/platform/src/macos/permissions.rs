//! macOS accessibility permission check.
//!
//! Uses AXIsProcessTrustedWithOptions to determine whether this
//! process has been granted accessibility permissions (required for
//! CGEventTap to intercept scroll events).

#![cfg(target_os = "macos")]

use core_foundation::base::CFTypeRef;
use core_foundation::dictionary::{CFDictionary, CFDictionaryCreateMutable, CFDictionarySetValue};
use core_foundation::string::CFString;
use std::ptr;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
}

type CFDictionaryRef = CFTypeRef;

/// Returns true if Accessibility permission is granted.
///
/// If `prompt` is true and permission is not yet granted, the system
/// will display the standard "Accessibility access required" dialog.
pub fn is_trusted(prompt: bool) -> bool {
    if prompt {
        unsafe {
            let key = CFString::from_static_string("kAXTrustedCheckOptionPrompt");
            let dict = CFDictionaryCreateMutable(
                ptr::null_mut(),
                0,
                &core_foundation::dictionary::kCFTypeDictionaryKeyCallBacks,
                &core_foundation::dictionary::kCFTypeDictionaryValueCallBacks,
            );
            if dict.is_null() {
                return false;
            }
            CFDictionarySetValue(dict, key.as_concrete_TypeRef(), core_foundation::boolean::CFBooleanTrueValue());
            let result = AXIsProcessTrustedWithOptions(dict);
            core_foundation::base::CFRelease(dict);
            result
        }
    } else {
        unsafe { AXIsProcessTrustedWithOptions(ptr::null_mut()) }
    }
}
