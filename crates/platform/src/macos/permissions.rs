//! macOS accessibility permission check.
//!
//! Uses the Application Services Accessibility API to determine whether this
//! process has been granted accessibility permissions (required for
//! CGEventTap to intercept scroll events).

#![cfg(target_os = "macos")]

use std::ffi::c_void;

/// Raw FFI: AXIsProcessTrustedWithOptions checks accessibility trust.
extern "C" {
    /// AXIsProcessTrustedWithOptions
    /// Returns true (1) if the process is trusted, false (0) otherwise.
    /// If options is non-null, it should be a CFDictionaryRef containing
    /// kAXTrustedCheckOptionPrompt as a key.
    fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;

    /// The key for the "prompt" option in the options dictionary.
    static kAXTrustedCheckOptionPrompt: *const c_void;
}

/// Returns true if Accessibility permission is granted.
///
/// If `prompt` is true and permission is not yet granted, the system
/// will display the standard "Accessibility access required" dialog.
pub fn is_trusted(prompt: bool) -> bool {
    if prompt {
        // Build a CFDictionary with kAXTrustedCheckOptionPrompt -> kCFBooleanTrue.
        // Using CoreFoundation FFI to construct the dictionary.
        unsafe {
            let keys = [kAXTrustedCheckOptionPrompt];
            let values = [kCFBooleanTrue];
            let dict = CFDictionaryCreate(
                std::ptr::null(),
                keys.as_ptr(),
                values.as_ptr(),
                1,
                &kCFTypeDictionaryKeyCallBacks,
                &kCFTypeDictionaryValueCallBacks,
            );
            let trusted = AXIsProcessTrustedWithOptions(dict as *const c_void);
            if !dict.is_null() {
                CFRelease(dict);
            }
            trusted
        }
    } else {
        // Just check without prompting (pass null options).
        unsafe { AXIsProcessTrustedWithOptions(std::ptr::null()) }
    }
}

/// CoreFoundation FFI helpers.
extern "C" {
    fn CFDictionaryCreate(
        allocator: *mut c_void,
        keys: *const *const c_void,
        values: *const *const c_void,
        num_values: isize,
        key_callbacks: *const c_void,
        value_callbacks: *const c_void,
    ) -> *mut c_void;

    fn CFRelease(cf: *mut c_void);

    static kCFBooleanTrue: *const c_void;
    static kCFTypeDictionaryKeyCallBacks: c_void;
    static kCFTypeDictionaryValueCallBacks: c_void;
}
