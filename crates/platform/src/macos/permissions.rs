//! Accessibility permission check. CGEventTap requires the user to grant
//! Accessibility access in System Settings → Privacy & Security.

#![cfg(target_os = "macos")]

use core_foundation::base::TCFType;
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::{CFString, CFStringRef};

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrustedWithOptions(options: *const std::os::raw::c_void) -> bool;
    static kAXTrustedCheckOptionPrompt: CFStringRef;
}

/// Returns true if Accessibility is granted. If `prompt = true`, also
/// surfaces the system permission dialog.
pub fn is_trusted(prompt: bool) -> bool {
    use core_foundation::boolean::CFBoolean;

    let key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
    let value = if prompt {
        CFBoolean::true_value()
    } else {
        CFBoolean::false_value()
    };
    let dict = CFDictionary::from_CFType_pairs(&[(key, value)]);

    unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef() as *const _) }
}
