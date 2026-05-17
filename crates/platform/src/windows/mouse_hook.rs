//! `WH_MOUSE_LL` hook on a dedicated thread.
//!
//! `SetWindowsHookEx` requires a thread that pumps messages — Tauri's main
//! thread is owned by webview/Tauri, so we spawn our own thread with a
//! `GetMessage` loop and install the hook there.
//!
//! The hook callback runs on this thread and dispatches into the
//! `HookEventSink` provided at install time. Modifier state is read from
//! a `ModifierSampler` snapshot — never via `GetAsyncKeyState` in the hot
//! path.

#![cfg(windows)]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{HookDecision, ModifierKeys, PlatformError, Result};
use crate::windows::keyboard::{ModifierSampler, ModifierState};
use parking_lot::Mutex;
use std::ptr::null_mut;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::Arc;
use std::thread;
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, MSG, WH_MOUSE_LL, WM_MOUSEHWHEEL, WM_MOUSEWHEEL,
    WM_QUIT,
};

#[repr(C)]
#[allow(non_snake_case)]
struct MsllHookStruct {
    pt_x: i32,
    pt_y: i32,
    mouse_data: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

const LLMHF_INJECTED: u32 = 0x00000001;
const LLMHF_LOWER_IL_INJECTED: u32 = 0x00000002;

struct HookContext {
    sink: Arc<dyn HookEventSink>,
    modifiers: Arc<ModifierState>,
    classifier_v: Mutex<smoothscroll_core::input_source::InputClassifier>,
    classifier_h: Mutex<smoothscroll_core::input_source::InputClassifier>,
    epoch: std::time::Instant,
}

static HOOK_CONTEXT: Mutex<Option<Arc<HookContext>>> = Mutex::new(None);
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);

pub struct WindowsMouseHook {
    sampler: Mutex<Option<ModifierSampler>>,
}

impl WindowsMouseHook {
    pub fn new() -> Self {
        Self {
            sampler: Mutex::new(None),
        }
    }
}

impl Default for WindowsMouseHook {
    fn default() -> Self {
        Self::new()
    }
}

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

impl MouseHook for WindowsMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let sampler = ModifierSampler::start();
        let modifier_state = sampler.state();
        *self.sampler.lock() = Some(sampler);

        *HOOK_CONTEXT.lock() = Some(Arc::new(HookContext {
            sink,
            modifiers: modifier_state,
            classifier_v: Mutex::new(smoothscroll_core::input_source::InputClassifier::new()),
            classifier_h: Mutex::new(smoothscroll_core::input_source::InputClassifier::new()),
            epoch: std::time::Instant::now(),
        }));

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<u32>>(1);
        let join = thread::Builder::new()
            .name("ss-mouse-hook".into())
            .spawn(move || pump_thread_main(tx))
            .map_err(|e| PlatformError::Os(format!("spawn hook thread: {e}")))?;

        let thread_id = rx
            .recv()
            .map_err(|_| PlatformError::Os("hook thread crashed before install".into()))??;

        let installed = InstalledHook {
            thread_id,
            join: Some(join),
        };
        Ok(HookHandle {
            _inner: Box::new(installed),
        })
    }
}

fn pump_thread_main(tx: std::sync::mpsc::SyncSender<Result<u32>>) {
    unsafe {
        let h_module = GetModuleHandleW(null_mut());
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(low_level_proc), h_module, 0);
        if hook.is_null() {
            let _ = tx.send(Err(PlatformError::Os(
                "SetWindowsHookExW returned NULL".into(),
            )));
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

unsafe extern "system" fn low_level_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }
    let ctx = match HOOK_CONTEXT.lock().as_ref().cloned() {
        Some(c) => c,
        None => return CallNextHookEx(null_mut(), n_code, w_param, l_param),
    };
    let data = &*(l_param as *const MsllHookStruct);
    if (data.flags & (LLMHF_INJECTED | LLMHF_LOWER_IL_INJECTED)) != 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let msg = w_param as u32;
    let raw_delta = ((data.mouse_data >> 16) & 0xFFFF) as i16;
    let delta = raw_delta as i32;
    let mods = ctx.modifiers.snapshot();

    let now_ms = ctx.epoch.elapsed().as_millis() as u64;
    let decision = match msg {
        x if x == WM_MOUSEWHEEL => {
            let source = ctx.classifier_v.lock().classify(delta, now_ms);
            ctx.sink.on_wheel_ext(delta, mods, source)
        }
        x if x == WM_MOUSEHWHEEL => {
            let source = ctx.classifier_h.lock().classify(delta, now_ms);
            ctx.sink.on_hwheel_ext(delta, source)
        }
        _ => HookDecision::Pass,
    };

    if matches!(decision, HookDecision::Swallow) {
        1
    } else {
        CallNextHookEx(null_mut(), n_code, w_param, l_param)
    }
}

// ModifierKeys re-export so the trait crate doesn't pull windows-sys.
#[allow(dead_code)]
fn _reexport_check(_m: ModifierKeys) {}
