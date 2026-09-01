#![cfg(windows)]

use crate::traits::EmissionContext;
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, OnceLock};
use std::thread;
use windows::core::Interface;
use windows::Win32::Foundation::POINT as AutomationPoint;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationScrollPattern, ScrollAmount_NoAmount,
    ScrollAmount_SmallDecrement, ScrollAmount_SmallIncrement, UIA_ScrollPatternId,
};
use windows_sys::Win32::Foundation::{GetLastError, BOOL, HWND, LPARAM, POINT, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumChildWindows, GetAncestor, GetClassNameW, GetCursorPos, GetParent, GetWindowRect,
    IsWindowVisible, PostMessageW, SendMessageTimeoutW, WindowFromPoint, GA_ROOT, SMTO_ABORTIFHUNG,
    WM_HSCROLL, WM_MOUSEWHEEL,
};

const WORKER_QUEUE_CAPACITY: usize = 64;
const MAX_UIA_ANCESTORS: usize = 16;
const NATIVE_SCROLL_TIMEOUT_MS: u32 = 100;
const WHEEL_DELTA: u32 = 120;

/// Per-axis generation tokens invalidated on semantic/raw/root transitions.
/// Queued compatibility commands capture the value they were planned for and
/// the worker re-checks it immediately before platform dispatch.
///
/// The vertical token exists so a root-window change (which resets both axes)
/// can also cancel any queued work, while a single-axis semantic/raw transition
/// bumps only the horizontal token used by compatibility dispatch.
#[derive(Debug, Default)]
pub struct AxisGenerations {
    #[cfg_attr(not(test), allow(dead_code))]
    vertical: AtomicU64,
    horizontal: AtomicU64,
}

struct WorkerHandle {
    sender: SyncSender<WorkerCommand>,
    generation: Arc<AxisGenerations>,
}

enum WorkerCommand {
    Legacy(HorizontalCommand),
    Semantic(SemanticHorizontalCommand),
}

#[derive(Debug)]
struct SemanticHorizontalCommand {
    point: ScreenPoint,
    units: i32,
    #[cfg_attr(not(test), allow(dead_code))]
    root_owner: Option<isize>,
    axis_generation: u64,
    #[allow(dead_code)]
    done: std::sync::mpsc::Sender<Result<()>>,
    generation: Arc<AxisGenerations>,
}

static WORKER: OnceLock<std::result::Result<WorkerHandle, String>> = OnceLock::new();

pub struct HorizontalScrollDispatcher;

impl HorizontalScrollDispatcher {
    pub fn initialize() -> Result<()> {
        WORKER
            .get_or_init(spawn_worker)
            .as_ref()
            .map(|_| ())
            .map_err(|error| {
                PlatformError::Os(format!("horizontal scroll worker unavailable: {error}"))
            })
    }

    pub fn dispatch(units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        let mut point = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point) } == 0 {
            return Err(PlatformError::Os("GetCursorPos failed".into()));
        }

        let sender = WORKER
            .get_or_init(spawn_worker)
            .as_ref()
            .map_err(|error| {
                PlatformError::Os(format!("horizontal scroll worker unavailable: {error}"))
            })?
            .sender
            .clone();
        let command = HorizontalCommand {
            point: ScreenPoint {
                x: point.x,
                y: point.y,
            },
            units,
        };

        sender
            .try_send(WorkerCommand::Legacy(command))
            .map_err(|error| match error {
                TrySendError::Full(_) => {
                    PlatformError::Os("horizontal scroll worker queue is full".into())
                }
                TrySendError::Disconnected(_) => {
                    PlatformError::Os("horizontal scroll worker disconnected".into())
                }
            })
    }

    /// Queue a semantic compatibility-horizontal command and wait for the
    /// worker's one-shot completion result. Runs on the engine thread only —
    /// never the low-level hook. A stale generation cancels with a distinct
    /// error so the caller can reset only the affected axis.
    pub fn dispatch_semantic(units: i32, context: EmissionContext) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        let mut point = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point) } == 0 {
            return Err(PlatformError::Os("GetCursorPos failed".into()));
        }

        let handle = WORKER.get_or_init(spawn_worker).as_ref().map_err(|error| {
            PlatformError::Os(format!("horizontal scroll worker unavailable: {error}"))
        })?;

        let (done_tx, done_rx) = std::sync::mpsc::channel::<Result<()>>();
        let command = SemanticHorizontalCommand {
            point: ScreenPoint {
                x: point.x,
                y: point.y,
            },
            units,
            root_owner: context.root_owner,
            axis_generation: context.axis_generation,
            generation: handle.generation.clone(),
            done: done_tx,
        };

        handle
            .sender
            .try_send(WorkerCommand::Semantic(command))
            .map_err(|error: TrySendError<WorkerCommand>| match error {
                TrySendError::Full(_) => {
                    PlatformError::Os("horizontal scroll worker queue is full".into())
                }
                TrySendError::Disconnected(_) => {
                    PlatformError::Os("horizontal scroll worker disconnected".into())
                }
            })?;

        done_rx
            .recv()
            .map_err(|_| PlatformError::Os("horizontal worker exited".into()))?
    }

    /// Invalidate queued compatibility commands for one axis. Called by the
    /// routing layer on semantic/raw/root transitions; never blocks the hook.
    /// Task 6 wires this into the app layer; until then it is intentionally
    /// unused outside tests.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn invalidate_axis(axis: crate::types::WheelAxis, root_changed: bool) {
        let Some(handle) = WORKER.get().map(|r| r.as_ref().ok()).flatten() else {
            return;
        };
        match axis {
            crate::types::WheelAxis::Vertical => {
                if root_changed {
                    handle.generation.vertical.fetch_add(1, Ordering::Release);
                }
            }
            crate::types::WheelAxis::Horizontal => {
                handle.generation.horizontal.fetch_add(1, Ordering::Release);
            }
        }
    }
}

fn spawn_worker() -> std::result::Result<WorkerHandle, String> {
    let (sender, receiver) = sync_channel(WORKER_QUEUE_CAPACITY);
    thread::Builder::new()
        .name("horizontal-scroll".into())
        .spawn(move || worker_loop(receiver))
        .map_err(|error| error.to_string())?;
    Ok(WorkerHandle {
        sender,
        generation: Arc::new(AxisGenerations::default()),
    })
}

fn worker_loop(receiver: Receiver<WorkerCommand>) {
    // SAFETY: this dedicated worker owns a fresh thread and initializes its
    // COM apartment exactly once before creating or using any COM interface.
    let com_initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
    let automation = if com_initialized {
        // SAFETY: COM is initialized on this worker, and the resulting UIA
        // interface never leaves or outlives the worker thread.
        unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) }.ok()
    } else {
        None
    };
    let mut backend = WindowsHorizontalBackend { automation };

    for command in receiver {
        match command {
            WorkerCommand::Legacy(command) => {
                if let Err(error) = scroll_with_backend(&mut backend, command) {
                    tracing::warn!(%error, "immediate horizontal scroll failed");
                }
            }
            WorkerCommand::Semantic(command) => {
                // The generation is re-checked immediately before dispatch so
                // a transition that landed after enqueue still cancels.
                let live = command.generation.horizontal.load(Ordering::Acquire)
                    == command.axis_generation;
                let result = if !live {
                    Err(PlatformError::Os(
                        "stale horizontal generation; command cancelled".into(),
                    ))
                } else {
                    scroll_with_backend(
                        &mut backend,
                        HorizontalCommand {
                            point: command.point,
                            units: command.units,
                        },
                    )
                    .map(|_| ())
                };
                let _ = command.done.send(result);
            }
        }
    }

    // Release the apartment-bound UI Automation pointer before COM teardown.
    drop(backend);
    if com_initialized {
        // SAFETY: balances the successful `CoInitializeEx` above on the same
        // worker thread after all apartment-bound interfaces were dropped.
        unsafe { CoUninitialize() };
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ScreenPoint {
    x: i32,
    y: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ScreenRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ScrollbarCandidate {
    hwnd: usize,
    visible: bool,
    rect: ScreenRect,
}

fn select_horizontal_scrollbar(
    candidates: &[ScrollbarCandidate],
    point: ScreenPoint,
) -> Option<usize> {
    candidates
        .iter()
        .filter(|candidate| {
            let width = candidate.rect.right - candidate.rect.left;
            let height = candidate.rect.bottom - candidate.rect.top;
            candidate.visible && width > height && height > 0
        })
        .min_by_key(|candidate| {
            let below = candidate.rect.top >= point.y;
            let vertical_distance = if below {
                candidate.rect.top - point.y
            } else {
                point.y - candidate.rect.bottom
            }
            .max(0);
            let horizontal_distance = if point.x < candidate.rect.left {
                candidate.rect.left - point.x
            } else if point.x > candidate.rect.right {
                point.x - candidate.rect.right
            } else {
                0
            };
            (vertical_distance, horizontal_distance, !below)
        })
        .map(|candidate| candidate.hwnd)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct HorizontalCommand {
    point: ScreenPoint,
    units: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScrollDirection {
    Left,
    Right,
}

impl ScrollDirection {
    fn from_units(units: i32) -> Option<Self> {
        match units.signum() {
            1 => Some(Self::Left),
            -1 => Some(Self::Right),
            _ => None,
        }
    }
}

fn direct_step_count(units: i32) -> u32 {
    if units == 0 {
        0
    } else {
        (units.unsigned_abs() / WHEEL_DELTA).max(1)
    }
}

fn scrollbar_command(
    direction: ScrollDirection,
) -> windows_sys::Win32::UI::WindowsAndMessaging::SCROLLBAR_COMMAND {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SB_LINELEFT, SB_LINERIGHT};
    match direction {
        ScrollDirection::Left => SB_LINELEFT,
        ScrollDirection::Right => SB_LINERIGHT,
    }
}

fn shift_wheel_wparam(units: i32) -> usize {
    const MK_SHIFT: usize = 0x0004;
    let delta = ((units as i16 as u16) as usize) << 16;
    MK_SHIFT | delta
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScrollMethod {
    Uia,
    NativeScrollbar,
    ShiftWheelFallback,
}

trait HorizontalBackend {
    fn scroll_uia(&mut self, command: HorizontalCommand) -> bool;
    fn scroll_native_scrollbar(&mut self, command: HorizontalCommand) -> bool;
    fn post_shift_wheel(&mut self, command: HorizontalCommand) -> Result<()>;
}

struct WindowsHorizontalBackend {
    automation: Option<IUIAutomation>,
}

impl HorizontalBackend for WindowsHorizontalBackend {
    fn scroll_uia(&mut self, command: HorizontalCommand) -> bool {
        self.automation
            .as_ref()
            .is_some_and(|automation| scroll_uia_ancestors(automation, command))
    }

    fn scroll_native_scrollbar(&mut self, command: HorizontalCommand) -> bool {
        scroll_native_child(command)
    }

    fn post_shift_wheel(&mut self, command: HorizontalCommand) -> Result<()> {
        post_shift_wheel(command)
    }
}

fn scroll_with_backend<B: HorizontalBackend>(
    backend: &mut B,
    command: HorizontalCommand,
) -> Result<Option<ScrollMethod>> {
    if ScrollDirection::from_units(command.units).is_none() {
        return Ok(None);
    }
    if backend.scroll_uia(command) {
        return Ok(Some(ScrollMethod::Uia));
    }
    if backend.scroll_native_scrollbar(command) {
        return Ok(Some(ScrollMethod::NativeScrollbar));
    }
    backend.post_shift_wheel(command)?;
    Ok(Some(ScrollMethod::ShiftWheelFallback))
}

fn scroll_uia_ancestors(automation: &IUIAutomation, command: HorizontalCommand) -> bool {
    let Some(direction) = ScrollDirection::from_units(command.units) else {
        return false;
    };
    let point = AutomationPoint {
        x: command.point.x,
        y: command.point.y,
    };

    // SAFETY: `automation` was created in the worker's initialized COM
    // apartment and is used only on that same worker while it remains alive.
    unsafe {
        let Ok(mut element) = automation.ElementFromPoint(point) else {
            return false;
        };
        let Ok(walker) = automation.ControlViewWalker() else {
            return false;
        };

        for _ in 0..MAX_UIA_ANCESTORS {
            if let Ok(pattern_object) = element.GetCurrentPattern(UIA_ScrollPatternId) {
                if let Ok(pattern) = pattern_object.cast::<IUIAutomationScrollPattern>() {
                    let horizontally_scrollable = pattern
                        .CurrentHorizontallyScrollable()
                        .is_ok_and(|value| value.as_bool());
                    if horizontally_scrollable {
                        let amount = match direction {
                            ScrollDirection::Left => ScrollAmount_SmallDecrement,
                            ScrollDirection::Right => ScrollAmount_SmallIncrement,
                        };
                        let mut scrolled = false;
                        for _ in 0..direct_step_count(command.units) {
                            if pattern.Scroll(amount, ScrollAmount_NoAmount).is_err() {
                                break;
                            }
                            scrolled = true;
                        }
                        if scrolled {
                            return true;
                        }
                    }
                }
            }

            let Ok(parent) = walker.GetParentElement(&element) else {
                break;
            };
            element = parent;
        }
    }
    false
}

struct EnumContext {
    point: ScreenPoint,
    candidates: Vec<ScrollbarCandidate>,
}

unsafe extern "system" fn collect_scrollbars(hwnd: HWND, l_param: LPARAM) -> BOOL {
    // SAFETY: `scroll_native_child` passes a non-null, aligned pointer to its
    // live stack-owned `EnumContext`. `EnumChildWindows` invokes this callback
    // synchronously, and no other reference accesses the context meanwhile.
    let context = &mut *(l_param as *mut EnumContext);
    if IsWindowVisible(hwnd) == 0 || !is_scrollbar_window(hwnd) {
        return 1;
    }

    let mut rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if GetWindowRect(hwnd, &mut rect) == 0 {
        return 1;
    }
    context.candidates.push(ScrollbarCandidate {
        hwnd: hwnd as usize,
        visible: true,
        rect: ScreenRect {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        },
    });
    1
}

unsafe fn is_scrollbar_window(hwnd: HWND) -> bool {
    let mut class_name = [0u16; 64];
    let length = GetClassNameW(hwnd, class_name.as_mut_ptr(), class_name.len() as i32);
    if length <= 0 {
        return false;
    }
    String::from_utf16_lossy(&class_name[..length as usize])
        .to_ascii_lowercase()
        .contains("scrollbar")
}

fn scroll_native_child(command: HorizontalCommand) -> bool {
    let Some(direction) = ScrollDirection::from_units(command.units) else {
        return false;
    };
    unsafe {
        let hit = WindowFromPoint(POINT {
            x: command.point.x,
            y: command.point.y,
        });
        if hit.is_null() {
            return false;
        }
        let root = GetAncestor(hit, GA_ROOT);
        if root.is_null() {
            return false;
        }

        let mut context = EnumContext {
            point: command.point,
            candidates: Vec::new(),
        };
        // SAFETY: `context` remains alive and exclusively borrowed for the
        // synchronous duration of `EnumChildWindows`; the callback casts this
        // exact pointer back to `EnumContext`.
        EnumChildWindows(
            root,
            Some(collect_scrollbars),
            &mut context as *mut EnumContext as LPARAM,
        );
        let Some(scrollbar) = select_horizontal_scrollbar(&context.candidates, context.point)
        else {
            return false;
        };
        let scrollbar = scrollbar as HWND;
        let owner = GetParent(scrollbar);
        if owner.is_null() {
            return false;
        }

        let mut scrolled = false;
        for _ in 0..direct_step_count(command.units) {
            let mut result = 0usize;
            let delivered = SendMessageTimeoutW(
                owner,
                WM_HSCROLL,
                scrollbar_command(direction) as usize,
                scrollbar as LPARAM,
                SMTO_ABORTIFHUNG,
                NATIVE_SCROLL_TIMEOUT_MS,
                &mut result,
            );
            if delivered == 0 {
                break;
            }
            scrolled = true;
        }
        scrolled
    }
}

fn post_shift_wheel(command: HorizontalCommand) -> Result<()> {
    unsafe {
        let point = POINT {
            x: command.point.x,
            y: command.point.y,
        };
        let target = WindowFromPoint(point);
        if target.is_null() {
            return Err(PlatformError::Os("WindowFromPoint returned null".into()));
        }
        let l_param = (((command.point.y as i16 as u16) as usize) << 16)
            | (command.point.x as i16 as u16) as usize;
        if PostMessageW(
            target,
            WM_MOUSEWHEEL,
            shift_wheel_wparam(command.units),
            l_param as LPARAM,
        ) == 0
        {
            return Err(PlatformError::Os(format!(
                "PostMessageW failed with error {}",
                GetLastError()
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default)]
    struct FakeBackend {
        uia_succeeds: bool,
        native_succeeds: bool,
        calls: Vec<ScrollMethod>,
    }

    impl HorizontalBackend for FakeBackend {
        fn scroll_uia(&mut self, _command: HorizontalCommand) -> bool {
            self.calls.push(ScrollMethod::Uia);
            self.uia_succeeds
        }

        fn scroll_native_scrollbar(&mut self, _command: HorizontalCommand) -> bool {
            self.calls.push(ScrollMethod::NativeScrollbar);
            self.native_succeeds
        }

        fn post_shift_wheel(&mut self, _command: HorizontalCommand) -> crate::types::Result<()> {
            self.calls.push(ScrollMethod::ShiftWheelFallback);
            Ok(())
        }
    }

    fn command(units: i32) -> HorizontalCommand {
        HorizontalCommand {
            point: ScreenPoint { x: 320, y: 240 },
            units,
        }
    }

    fn candidate(
        hwnd: usize,
        visible: bool,
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    ) -> ScrollbarCandidate {
        ScrollbarCandidate {
            hwnd,
            visible,
            rect: ScreenRect {
                left,
                top,
                right,
                bottom,
            },
        }
    }

    #[test]
    fn horizontal_scroll_direction_matches_shift_wheel() {
        assert_eq!(
            ScrollDirection::from_units(120),
            Some(ScrollDirection::Left)
        );
        assert_eq!(
            ScrollDirection::from_units(-120),
            Some(ScrollDirection::Right)
        );
        assert_eq!(ScrollDirection::from_units(0), None);
    }

    #[test]
    fn direct_scroll_step_count_preserves_multi_notch_magnitude() {
        assert_eq!(direct_step_count(0), 0);
        assert_eq!(direct_step_count(120), 1);
        assert_eq!(direct_step_count(-120), 1);
        assert_eq!(direct_step_count(240), 2);
        assert_eq!(direct_step_count(-360), 3);
    }

    #[test]
    fn horizontal_scroll_stops_after_uia_success() {
        let mut backend = FakeBackend {
            uia_succeeds: true,
            ..Default::default()
        };

        let method = scroll_with_backend(&mut backend, command(120)).unwrap();

        assert_eq!(method, Some(ScrollMethod::Uia));
        assert_eq!(backend.calls, vec![ScrollMethod::Uia]);
    }

    #[test]
    fn horizontal_scroll_uses_native_scrollbar_after_uia_miss() {
        let mut backend = FakeBackend {
            native_succeeds: true,
            ..Default::default()
        };

        let method = scroll_with_backend(&mut backend, command(-120)).unwrap();

        assert_eq!(method, Some(ScrollMethod::NativeScrollbar));
        assert_eq!(
            backend.calls,
            vec![ScrollMethod::Uia, ScrollMethod::NativeScrollbar]
        );
    }

    #[test]
    fn horizontal_scroll_falls_back_only_after_direct_capabilities_miss() {
        let mut backend = FakeBackend::default();

        let method = scroll_with_backend(&mut backend, command(120)).unwrap();

        assert_eq!(method, Some(ScrollMethod::ShiftWheelFallback));
        assert_eq!(
            backend.calls,
            vec![
                ScrollMethod::Uia,
                ScrollMethod::NativeScrollbar,
                ScrollMethod::ShiftWheelFallback,
            ]
        );
    }

    #[test]
    fn horizontal_scrollbar_selection_ignores_vertical_and_hidden_candidates() {
        let point = ScreenPoint { x: 500, y: 400 };
        let candidates = [
            candidate(1, true, 900, 200, 920, 800),
            candidate(2, false, 100, 450, 800, 470),
            candidate(3, true, 100, 700, 800, 720),
            candidate(4, true, 100, 500, 800, 520),
        ];

        assert_eq!(select_horizontal_scrollbar(&candidates, point), Some(4));
    }

    #[test]
    fn horizontal_scrollbar_selection_prefers_bar_below_the_content_point() {
        let point = ScreenPoint { x: 500, y: 600 };
        let candidates = [
            candidate(10, true, 100, 300, 800, 320),
            candidate(11, true, 100, 800, 800, 820),
        ];

        assert_eq!(select_horizontal_scrollbar(&candidates, point), Some(11));
    }

    #[test]
    fn horizontal_scrollbar_selection_handles_excel_sheet_tabs_beside_the_bar() {
        let point = ScreenPoint { x: 300, y: 600 };
        let candidates = [candidate(20, true, 1000, 800, 1600, 820)];

        assert_eq!(select_horizontal_scrollbar(&candidates, point), Some(20));
    }

    #[test]
    fn horizontal_scrollbar_selection_prefers_overlapping_bar_over_distant_lower_bar() {
        let point = ScreenPoint { x: 500, y: 600 };
        let candidates = [
            candidate(30, true, 100, 590, 800, 610),
            candidate(31, true, 100, 800, 800, 820),
        ];

        assert_eq!(select_horizontal_scrollbar(&candidates, point), Some(30));
    }

    #[test]
    fn horizontal_message_mapping_preserves_browser_direction() {
        assert_eq!(
            scrollbar_command(ScrollDirection::Left),
            windows_sys::Win32::UI::WindowsAndMessaging::SB_LINELEFT
        );
        assert_eq!(
            scrollbar_command(ScrollDirection::Right),
            windows_sys::Win32::UI::WindowsAndMessaging::SB_LINERIGHT
        );
        assert_eq!(shift_wheel_wparam(120), 0x0078_0004);
        assert_eq!(shift_wheel_wparam(-120), 0xFF88_0004);
    }
}
