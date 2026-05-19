#![cfg(windows)]

use crate::traits::{HookHandle, KeyboardScrollHook, KeyboardScrollSink};
use crate::types::{HookDecision, KeyboardKeyEvent, PlatformError, Result};
use parking_lot::Mutex;
use smoothscroll_core::keyboard_scroll::KeyboardScrollKey;
use std::ptr::null_mut;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_DOWN, VK_NEXT, VK_PRIOR, VK_SHIFT, VK_SPACE, VK_UP,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT,
    WM_SYSKEYDOWN, WM_SYSKEYUP,
};

#[repr(C)]
#[allow(non_snake_case)]
struct KbdllHookStruct {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

const LLKHF_INJECTED: u32 = 0x00000010;

struct HookContext {
    sink: Arc<dyn KeyboardScrollSink>,
    last_vk: Mutex<Option<(u32, Instant)>>,
}

static HOOK_CONTEXT: Mutex<Option<Arc<HookContext>>> = Mutex::new(None);
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);

pub struct WindowsKeyboardScrollHook;

struct InstalledHook {
    thread_id: u32,
    join: Option<thread::JoinHandle<()>>,
}

impl Drop for InstalledHook {
    fn drop(&mut self) {
        unsafe {
            PostThreadMessageW(self.thread_id, WM_QUIT, 0, 0);
        }
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
    }
}

impl KeyboardScrollHook for WindowsKeyboardScrollHook {
    fn install(&self, sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle> {
        *HOOK_CONTEXT.lock() = Some(Arc::new(HookContext {
            sink,
            last_vk: Mutex::new(None),
        }));

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<u32>>(1);
        let join = thread::Builder::new()
            .name("ss-keyboard-hook".into())
            .spawn(move || pump(tx))
            .map_err(|e| PlatformError::Os(format!("spawn keyboard thread: {e}")))?;

        let thread_id = rx
            .recv()
            .map_err(|_| PlatformError::Os("keyboard thread crashed".into()))??;

        Ok(HookHandle::new(Box::new(InstalledHook {
            thread_id,
            join: Some(join),
        })))
    }
}

fn pump(tx: std::sync::mpsc::SyncSender<Result<u32>>) {
    unsafe {
        let h_module = GetModuleHandleW(null_mut());
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_proc), h_module, 0);
        if hook.is_null() {
            let _ = tx.send(Err(PlatformError::Os("SetWindowsHookExW NULL".into())));
            return;
        }
        HOOK_HANDLE.store(hook as isize, Ordering::SeqCst);
        let _ = tx.send(Ok(GetCurrentThreadId()));

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        let _ = UnhookWindowsHookEx(hook);
        HOOK_HANDLE.store(0, Ordering::SeqCst);
        *HOOK_CONTEXT.lock() = None;
    }
}

unsafe fn shift_pressed() -> bool {
    (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0
}

fn vk_to_key(vk: u32, shift: bool) -> Option<KeyboardScrollKey> {
    match vk {
        x if x == VK_NEXT as u32 => Some(KeyboardScrollKey::PageDown),
        x if x == VK_PRIOR as u32 => Some(KeyboardScrollKey::PageUp),
        x if x == VK_SPACE as u32 => Some(if shift {
            KeyboardScrollKey::ShiftSpace
        } else {
            KeyboardScrollKey::Space
        }),
        x if x == VK_DOWN as u32 => Some(KeyboardScrollKey::ArrowDown),
        x if x == VK_UP as u32 => Some(KeyboardScrollKey::ArrowUp),
        _ => None,
    }
}

unsafe extern "system" fn low_level_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }
    let ctx = match HOOK_CONTEXT.lock().as_ref().cloned() {
        Some(c) => c,
        None => return CallNextHookEx(null_mut(), n_code, w_param, l_param),
    };

    let msg = w_param as u32;
    let data = &*(l_param as *const KbdllHookStruct);

    if (data.flags & LLKHF_INJECTED) != 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let is_down = matches!(msg, x if x == WM_KEYDOWN || x == WM_SYSKEYDOWN);
    let is_up = matches!(msg, x if x == WM_KEYUP || x == WM_SYSKEYUP);

    if is_up {
        let mut last = ctx.last_vk.lock();
        if matches!(*last, Some((v, _)) if v == data.vk_code) {
            *last = None;
        }
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }
    if !is_down {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let Some(key) = vk_to_key(data.vk_code, shift_pressed()) else {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    };

    let mut last = ctx.last_vk.lock();
    let now = Instant::now();
    let is_autorepeat = matches!(*last, Some((v, t)) if v == data.vk_code && now.duration_since(t).as_millis() < 50);
    *last = Some((data.vk_code, now));
    drop(last);

    let decision = ctx.sink.on_key(KeyboardKeyEvent { key, is_autorepeat });
    if matches!(decision, HookDecision::Swallow) {
        1
    } else {
        CallNextHookEx(null_mut(), n_code, w_param, l_param)
    }
}
