//! Global hotkey via `RegisterHotKey`. Owns a dedicated message-pump thread
//! that survives until the returned `HotkeyHandle` is dropped.
//!
//! Accelerator parsing supports the simple form Tauri uses:
//! "CommandOrControl+Alt+S" — case-insensitive, "+" separated.

#![cfg(windows)]

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use windows_sys::Win32::Foundation::WPARAM;
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, MOD_WIN,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetMessageW, PostThreadMessageW, TranslateMessage, MSG, WM_HOTKEY, WM_QUIT,
};

const HOTKEY_ID: i32 = 1;

pub struct WindowsHotkey;

impl Hotkey for WindowsHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (modifiers, vk) = parse_accelerator(&accel.raw)?;

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<u32>>(1);
        let on_pressed = Arc::new(on_pressed);
        let alive = Arc::new(AtomicBool::new(true));

        let on_pressed_thread = on_pressed.clone();
        let alive_thread = alive.clone();
        let join = thread::Builder::new()
            .name("ss-hotkey".into())
            .spawn(move || pump_thread(modifiers, vk, on_pressed_thread, alive_thread, tx))
            .map_err(|e| PlatformError::Os(format!("spawn hotkey thread: {e}")))?;

        let thread_id = rx
            .recv()
            .map_err(|_| PlatformError::Os("hotkey thread died before register".into()))??;

        struct Installed {
            thread_id: u32,
            alive: Arc<AtomicBool>,
            join: Option<thread::JoinHandle<()>>,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
                unsafe {
                    PostThreadMessageW(self.thread_id, WM_QUIT, 0, 0);
                }
                if let Some(h) = self.join.take() {
                    let _ = h.join();
                }
            }
        }

        Ok(HotkeyHandle::new(Box::new(Installed {
            thread_id,
            alive,
            join: Some(join),
        })))
    }
}

fn pump_thread(
    modifiers: u32,
    vk: u32,
    on_pressed: Arc<Box<dyn Fn() + Send + Sync>>,
    alive: Arc<AtomicBool>,
    tx: std::sync::mpsc::SyncSender<Result<u32>>,
) {
    unsafe {
        let registered = RegisterHotKey(
            std::ptr::null_mut(),
            HOTKEY_ID,
            modifiers | MOD_NOREPEAT,
            vk,
        );
        if registered == 0 {
            let _ = tx.send(Err(PlatformError::Os(
                "RegisterHotKey failed (already in use?)".into(),
            )));
            return;
        }
        let _ = tx.send(Ok(GetCurrentThreadId()));

        let mut msg: MSG = std::mem::zeroed();
        while alive.load(Ordering::SeqCst) {
            let r = GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0);
            if r == 0 || r == -1 {
                break;
            }
            if msg.message == WM_HOTKEY && msg.wParam == HOTKEY_ID as WPARAM {
                on_pressed();
                continue;
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        let _ = UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID);
    }
}

fn parse_accelerator(raw: &str) -> Result<(u32, u32)> {
    let mut modifiers: u32 = 0;
    let mut vk: Option<u32> = None;
    for part in raw.split('+').map(|p| p.trim()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" | "commandorcontrol" => modifiers |= MOD_CONTROL,
            "alt" | "option" => modifiers |= MOD_ALT,
            "shift" => modifiers |= MOD_SHIFT,
            "super" | "win" | "cmd" | "command" => modifiers |= MOD_WIN,
            other => {
                vk = Some(parse_key(other)?);
            }
        }
    }
    let vk = vk.ok_or_else(|| PlatformError::Os(format!("no key in accelerator '{raw}'")))?;
    Ok((modifiers, vk))
}

fn parse_key(s: &str) -> Result<u32> {
    if s.len() == 1 {
        let c = s.chars().next().unwrap().to_ascii_uppercase();
        if c.is_ascii_alphanumeric() {
            return Ok(c as u32);
        }
    }
    Err(PlatformError::Os(format!("unsupported key '{s}'")))
}
