#![cfg(windows)]

use std::mem;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO,
};

const TEXT_INPUT_CLASSES: &[&str] = &[
    "Edit",
    "RichEdit",
    "RICHEDIT50W",
    "RichEdit20A",
    "RichEdit20W",
    "Scintilla",
    "OpenEdit",
    "_WwG",
];

pub fn is_focus_in_text_input() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }
        let tid = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());
        let mut gti: GUITHREADINFO = mem::zeroed();
        gti.cbSize = mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(tid, &mut gti) == 0 {
            return false;
        }

        if !gti.hwndCaret.is_null() {
            return true;
        }
        let focus = if gti.hwndFocus.is_null() {
            hwnd
        } else {
            gti.hwndFocus
        };
        let mut buf = [0u16; 64];
        let n = GetClassNameW(focus, buf.as_mut_ptr(), buf.len() as i32);
        let class = String::from_utf16_lossy(&buf[..n as usize]);
        TEXT_INPUT_CLASSES.contains(&class.as_str())
    }
}
