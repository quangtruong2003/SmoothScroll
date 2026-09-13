#![cfg(windows)]

use smoothscroll_core::input_source::InputClassifier;
use std::fs::File;
use std::io::Write;
use std::ptr::null_mut;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleA, GetModuleHandleW, GetProcAddress};
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, MSG, WH_MOUSE_LL, WM_MOUSEHWHEEL, WM_MOUSEWHEEL,
    WM_QUIT,
};

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
struct InputMessageSource {
    device_type: u32,
    origin_id: u32,
}

#[repr(C)]
struct MsllHookStruct {
    pt_x: i32,
    pt_y: i32,
    mouse_data: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

const IMDT_UNAVAILABLE: u32 = 0x0000_0000;
const IMDT_KEYBOARD: u32 = 0x0000_0001;
const IMDT_MOUSE: u32 = 0x0000_0002;
const IMDT_TOUCH: u32 = 0x0000_0004;
const IMDT_PEN: u32 = 0x0000_0008;
const IMDT_TOUCHPAD: u32 = 0x0000_0010;

const IMO_UNAVAILABLE: u32 = 0x0000_0000;
const IMO_HARDWARE: u32 = 0x0000_0001;
const IMO_INJECTED: u32 = 0x0000_0002;
const IMO_SYSTEM: u32 = 0x0000_0004;

type GetInputSourceFn = unsafe extern "system" fn(*mut InputMessageSource) -> i32;
type RegisterTouchpadThreadFn = unsafe extern "system" fn(i32) -> i32;

#[derive(Clone, Copy)]
struct NativeApis {
    current: Option<GetInputSourceFn>,
    cimssm: Option<GetInputSourceFn>,
    register_thread: Option<RegisterTouchpadThreadFn>,
}

static APIS: OnceLock<NativeApis> = OnceLock::new();
static EPOCH: OnceLock<Instant> = OnceLock::new();
static CLASSIFIER_V: OnceLock<Mutex<InputClassifier>> = OnceLock::new();
static CLASSIFIER_H: OnceLock<Mutex<InputClassifier>> = OnceLock::new();
static LOG_FILE: OnceLock<Mutex<File>> = OnceLock::new();

macro_rules! diag_log {
    ($($arg:tt)*) => {{
        let line = format!($($arg)*);
        println!("{line}");
        if let Some(file) = LOG_FILE.get() {
            let mut file = file.lock().unwrap();
            let _ = writeln!(file, "{line}");
            let _ = file.flush();
        }
    }};
}

fn device_name(value: u32) -> &'static str {
    match value {
        IMDT_UNAVAILABLE => "IMDT_UNAVAILABLE",
        IMDT_KEYBOARD => "IMDT_KEYBOARD",
        IMDT_MOUSE => "IMDT_MOUSE",
        IMDT_TOUCH => "IMDT_TOUCH",
        IMDT_PEN => "IMDT_PEN",
        IMDT_TOUCHPAD => "IMDT_TOUCHPAD",
        _ => "IMDT_OTHER",
    }
}

fn origin_name(value: u32) -> &'static str {
    match value {
        IMO_UNAVAILABLE => "IMO_UNAVAILABLE",
        IMO_HARDWARE => "IMO_HARDWARE",
        IMO_INJECTED => "IMO_INJECTED",
        IMO_SYSTEM => "IMO_SYSTEM",
        _ => "IMO_OTHER",
    }
}

fn candidate_name(device_type: u32) -> &'static str {
    match device_type {
        IMDT_TOUCHPAD => "Touchpad",
        IMDT_MOUSE => "Mouse",
        _ => "Unknown",
    }
}

unsafe fn load_apis() -> NativeApis {
    let user32 = GetModuleHandleA(b"user32.dll\0".as_ptr());
    let current = GetProcAddress(user32, b"GetCurrentInputMessageSource\0".as_ptr())
        .map(|p| std::mem::transmute::<unsafe extern "system" fn() -> isize, GetInputSourceFn>(p));
    let cimssm = GetProcAddress(user32, b"GetCIMSSM\0".as_ptr())
        .map(|p| std::mem::transmute::<unsafe extern "system" fn() -> isize, GetInputSourceFn>(p));
    let register_thread = GetProcAddress(user32, b"RegisterTouchpadCapableThread\0".as_ptr()).map(
        |p| {
            std::mem::transmute::<unsafe extern "system" fn() -> isize, RegisterTouchpadThreadFn>(p)
        },
    );
    NativeApis {
        current,
        cimssm,
        register_thread,
    }
}

fn query_source(api: Option<GetInputSourceFn>) -> (bool, InputMessageSource) {
    let Some(api) = api else {
        return (false, InputMessageSource::default());
    };
    let mut source = InputMessageSource::default();
    let ok = unsafe { api(&mut source) } != 0;
    (ok, source)
}

unsafe extern "system" fn low_level_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let msg = w_param as u32;
    if msg != WM_MOUSEWHEEL && msg != WM_MOUSEHWHEEL {
        return CallNextHookEx(null_mut(), n_code, w_param, l_param);
    }

    let data = &*(l_param as *const MsllHookStruct);
    let delta = (((data.mouse_data >> 16) & 0xffff) as i16) as i32;
    let now_ms = EPOCH.get().unwrap().elapsed().as_millis() as u64;

    let heuristic = if msg == WM_MOUSEWHEEL {
        CLASSIFIER_V
            .get()
            .unwrap()
            .lock()
            .unwrap()
            .classify(delta, now_ms)
    } else {
        CLASSIFIER_H
            .get()
            .unwrap()
            .lock()
            .unwrap()
            .classify(delta, now_ms)
    };

    let apis = *APIS.get().unwrap();
    let (current_ok, current) = query_source(apis.current);
    let (cimssm_ok, cimssm) = if current_ok && current.device_type == IMDT_UNAVAILABLE {
        query_source(apis.cimssm)
    } else {
        (false, InputMessageSource::default())
    };

    let candidate_device = if current_ok && current.device_type != IMDT_UNAVAILABLE {
        current.device_type
    } else if cimssm_ok {
        cimssm.device_type
    } else {
        IMDT_UNAVAILABLE
    };

    diag_log!(
        "event axis={} delta={} flags=0x{:08x} time={} extra=0x{:x} current={{ok:{} device:{}({:#x}) origin:{}({:#x})}} cimssm={{called:{} ok:{} device:{}({:#x}) origin:{}({:#x})}} heuristic={:?} candidate={}",
        if msg == WM_MOUSEWHEEL { "V" } else { "H" },
        delta,
        data.flags,
        data.time,
        data.dw_extra_info,
        current_ok,
        device_name(current.device_type),
        current.device_type,
        origin_name(current.origin_id),
        current.origin_id,
        current_ok && current.device_type == IMDT_UNAVAILABLE,
        cimssm_ok,
        device_name(cimssm.device_type),
        cimssm.device_type,
        origin_name(cimssm.origin_id),
        cimssm.origin_id,
        heuristic,
        candidate_name(candidate_device),
    );

    CallNextHookEx(null_mut(), n_code, w_param, l_param)
}

fn main() {
    let mut args = std::env::args().skip(1);
    let mode = args.next().unwrap_or_else(|| "a".to_string()).to_ascii_lowercase();
    let seconds: u64 = args
        .next()
        .as_deref()
        .unwrap_or("90")
        .parse()
        .expect("seconds must be an integer");
    let log_path = args.next();
    assert!(mode == "a" || mode == "b", "mode must be a or b");
    if let Some(path) = log_path {
        LOG_FILE
            .set(Mutex::new(File::create(path).expect("create diagnostic log")))
            .ok();
    }

    let apis = unsafe { load_apis() };
    APIS.set(apis).ok();
    EPOCH.set(Instant::now()).ok();
    CLASSIFIER_V.set(Mutex::new(InputClassifier::new())).ok();
    CLASSIFIER_H.set(Mutex::new(InputClassifier::new())).ok();

    diag_log!(
        "diag_start mode={} seconds={} apis current={} cimssm={} register_thread={}",
        mode.to_ascii_uppercase(),
        seconds,
        apis.current.is_some(),
        apis.cimssm.is_some(),
        apis.register_thread.is_some()
    );

    let mut registered = false;
    if mode == "b" {
        if let Some(register) = apis.register_thread {
            let ok = unsafe { register(1) } != 0;
            registered = ok;
            diag_log!("register_touchpad_capable_thread enable=true ok={ok}");
        } else {
            diag_log!("register_touchpad_capable_thread enable=true unavailable");
        }
    }

    unsafe {
        let module = GetModuleHandleW(null_mut());
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(low_level_proc), module, 0);
        if hook.is_null() {
            diag_log!("SetWindowsHookExW failed");
            if registered {
                if let Some(register) = apis.register_thread {
                    diag_log!(
                        "register_touchpad_capable_thread enable=false ok={}",
                        register(0) != 0
                    );
                }
            }
            std::process::exit(2);
        }

        let thread_id = GetCurrentThreadId();
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(seconds));
            PostThreadMessageW(thread_id, WM_QUIT, 0, 0);
        });

        diag_log!("hook_installed thread_id={thread_id}");
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        UnhookWindowsHookEx(hook);
    }

    if registered {
        if let Some(register) = apis.register_thread {
            let ok = unsafe { register(0) } != 0;
            diag_log!("register_touchpad_capable_thread enable=false ok={ok}");
        }
    }
    diag_log!("diag_end mode={}", mode.to_ascii_uppercase());
}
