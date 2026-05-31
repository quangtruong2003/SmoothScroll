//! macOS accessibility permission check.
//!
//! Uses AXIsProcessTrustedWithOptions to determine whether this
//! process has been granted accessibility permissions (required for
//! CGEventTap to intercept scroll events).

#![cfg(target_os = "macos")]

use core_foundation::base::CFTypeRef;
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFMutableDictionary;
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
        // Build a CFDictionary with kAXTrustedCheckOptionPrompt = true.
        let key = CFString::from_static_string("kAXTrustedCheckOptionPrompt");
        let mut dict = CFMutableDictionary::from_CFType_refs(&[
            (key.as_CFType(), CFBoolean::true_value().as_CFType()),
        ]);
        unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef() as CFDictionaryRef) }
    } else {
        unsafe { AXIsProcessTrustedWithOptions(ptr::null_mut()) }
    }
}