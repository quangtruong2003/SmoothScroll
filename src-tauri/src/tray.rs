//! System tray icon.
//!
//! - Left-click: toggle enabled/disabled
//! - Double-left-click: open main settings window. Windows still delivers
//!   two single-click Ups around the DoubleClick event, so the two toggles
//!   cancel each other out and the net effect is just opening Settings.
//! - Right-click: show the floating tray-panel window at cursor position
//!
//! The panel is a frameless WebView window rendered via React.

use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Listener, Manager, PhysicalPosition, Runtime,
};

const TRAY_ID: &str = "main";
const PANEL_LABEL: &str = "tray-panel";

/// Set once the frontend has reported the panel's real content size via
/// `resize_tray_panel`. Until then the window still carries its configured
/// default size (220x600), which is almost never the content size, so the
/// first open must not be shown at that size.
static PANEL_MEASURED: AtomicBool = AtomicBool::new(false);
/// Set while the panel is shown off-screen waiting for its first content
/// measurement; `resize_panel` then moves it to the anchor position.
static PANEL_PENDING_REVEAL: AtomicBool = AtomicBool::new(false);

/// Returns the tray icon image for the given enabled state.
fn icon_for<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Image<'static> {
    fn default_owned<R: Runtime>(app: &AppHandle<R>) -> Image<'static> {
        app.default_window_icon()
            .map(|img| Image::new_owned(img.rgba().to_vec(), img.width(), img.height()))
            .unwrap_or_else(|| unreachable!("default window icon missing"))
    }
    if enabled {
        default_owned(app)
    } else {
        let bytes: &[u8] = include_bytes!("../icons/tray-disabled.png");
        Image::from_bytes(bytes)
            .map(|img| Image::new_owned(img.rgba().to_vec(), img.width(), img.height()))
            .unwrap_or_else(|_| default_owned(app))
    }
}

/// Get the current cursor position using Tauri's built-in API when available,
/// with platform-specific fallbacks.
fn cursor_position<R: Runtime>(app: &AppHandle<R>) -> PhysicalPosition<i32> {
    // Try Tauri's built-in cursor_position API first (works on all platforms)
    // Note: cursor_position returns PhysicalPosition<f64>, we convert to i32
    if let Ok(pos) = app.cursor_position() {
        return PhysicalPosition::new(pos.x as i32, pos.y as i32);
    }

    // Platform-specific fallbacks. Note: Tauri's built-in cursor_position
    // already handles multi-monitor coordinate conversion correctly on
    // macOS (it uses NSEvent.mouseLocation under the hood). The CoreGraphics
    // CGEventCreate fallback we used to ship here produced wrong coords
    // for cursors on secondary displays because CGEventGetLocation returns
    // bottom-left-origin coordinates relative to the main display's
    // bottom-left corner, and CGDisplayBounds(main) only covers the main
    // display. If Tauri's API fails we fall through to a safe default
    // rather than producing bad coordinates.
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut point = POINT::default();
        unsafe {
            if GetCursorPos(&mut point).is_ok() {
                return PhysicalPosition::new(point.x, point.y);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use x11::xlib;
        let d = unsafe { xlib::XOpenDisplay(std::ptr::null()) };
        if d.is_null() {
            // X11 not available (Wayland session) - use fallback
            tracing::debug!("X11 not available, using fallback cursor position");
            return PhysicalPosition::new(960, 540);
        }
        let mut root: xlib::Window = 0;
        let mut child: xlib::Window = 0;
        let mut root_x: i32 = 0;
        let mut root_y: i32 = 0;
        let mut win_x: i32 = 0;
        let mut win_y: i32 = 0;
        let mut mask: u32 = 0;
        let _ = unsafe {
            xlib::XQueryPointer(
                d,
                xlib::XDefaultRootWindow(d),
                &mut root,
                &mut child,
                &mut root_x,
                &mut root_y,
                &mut win_x,
                &mut win_y,
                &mut mask,
            )
        };
        let pos = PhysicalPosition::new(root_x, root_y);
        unsafe { xlib::XCloseDisplay(d) };
        return pos;
    }

    // Final fallback: center of primary monitor
    PhysicalPosition::new(960, 540)
}

/// Compute the anchor position for a panel of the given size: horizontally
/// centered on the cursor (clamped to the work area), vertically pinned just
/// above the taskbar edge of the primary monitor's work area.
fn compute_anchor_position<R: Runtime>(app: &AppHandle<R>, panel_w: i32, panel_h: i32) -> (i32, i32) {
    let cursor = cursor_position(app);
    let edge_gap = 2;

    let monitor = app.primary_monitor().ok().flatten();
    let work_area = monitor.as_ref().map(|m| m.work_area());

    let work_x = work_area.as_ref().map(|w| w.position.x).unwrap_or(0);
    let work_y = work_area.as_ref().map(|w| w.position.y).unwrap_or(0);
    let work_w = work_area
        .as_ref()
        .map(|w| w.size.width as i32)
        .unwrap_or(1920);
    let work_h = work_area
        .as_ref()
        .map(|w| w.size.height as i32)
        .unwrap_or(1080);

    // Tauri's AppHandle::cursor_position returns top-left-origin coordinates
    // on every platform (NSEvent.mouseLocation flipped on macOS, XQueryPointer
    // on Linux, GetCursorPos on Windows). No platform-specific conversion
    // is needed here — see cursor_position() above for the fallback policy.

    // Anchor vertically to the bottom edge of the work area (just above taskbar).
    let mut y = work_y + work_h - panel_h - edge_gap;

    // Center horizontally at cursor, then clamp to the work area.
    let mut x = cursor.x - panel_w / 2;
    if x + panel_w > work_x + work_w {
        x = work_x + work_w - panel_w - edge_gap;
    }
    if x < work_x {
        x = work_x + edge_gap;
    }
    if y < work_y {
        y = work_y + edge_gap;
    }

    (x, y)
}

/// Position the panel window near the cursor, anchored to the taskbar edge
/// (the boundary of the primary monitor's work area). Uses the panel's
/// actual current height (which the frontend resizes to fit content) so
/// the bottom edge stays glued to the taskbar regardless of content size.
fn position_panel_at_cursor<R: Runtime>(app: &AppHandle<R>, win: &tauri::WebviewWindow<R>) {
    let panel_w = win.outer_size().map(|s| s.width as i32).unwrap_or(260);
    let panel_h = win.outer_size().map(|s| s.height as i32).unwrap_or(480);
    let (x, y) = compute_anchor_position(app, panel_w, panel_h);
    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
}

/// Resize the tray panel to match content height, keeping the bottom edge
/// pinned to the taskbar. Frontend invokes this through ResizeObserver.
pub fn resize_panel<R: Runtime>(app: &AppHandle<R>, width: u32, height: u32) {
    let Some(win) = app.get_webview_window(PANEL_LABEL) else {
        return;
    };

    // Any report from the frontend means the content has been laid out and
    // measured, so the window size is trustworthy from here on.
    PANEL_MEASURED.store(true, Ordering::SeqCst);

    // Clamp to a sane range so a measurement glitch can't shrink the panel
    // to nothing or push it off-screen.
    let monitor = app.primary_monitor().ok().flatten();
    let work_area = monitor.as_ref().and_then(|m| Some(m.work_area()));

    let max_h = work_area
        .map(|w| w.size.height.saturating_sub(40))
        .unwrap_or(800);
    let min_h = 120u32;
    let clamped_height = height.clamp(min_h, max_h);

    let min_w = 200u32;
    let max_w = 480u32;
    let clamped_width = width.clamp(min_w, max_w);

    // First measurement after app start: the panel was parked off-screen so
    // the WebView could lay out at its real content size. Now that we know
    // that size, move it to the anchor position and reveal it.
    if PANEL_PENDING_REVEAL.swap(false, Ordering::SeqCst) {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: clamped_width,
            height: clamped_height,
        }));
        let (x, y) = compute_anchor_position(app, clamped_width as i32, clamped_height as i32);
        let _ = win.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
        let _ = win.set_focus();
        return;
    }

    // Normal path: pin the bottom edge — new top = previous bottom - new height.
    // Read the current geometry BEFORE resizing so the bottom edge stays put.
    let Ok(cur_pos) = win.outer_position() else {
        return;
    };
    let Ok(cur_size) = win.outer_size() else {
        return;
    };

    let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: clamped_width,
        height: clamped_height,
    }));

    let bottom = cur_pos.y + cur_size.height as i32;
    let new_y = bottom - clamped_height as i32;

    // Clamp the new Y position to keep panel on screen
    let work_y = work_area.map(|w| w.position.y).unwrap_or(0);
    let final_y = new_y.max(work_y);

    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition {
        x: cur_pos.x,
        y: final_y,
    }));
}

/// Show the tray panel window at the cursor position.
fn show_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    // Capture the foreground process BEFORE showing the panel — otherwise
    // the panel itself becomes the foreground window and the captured name
    // is wrong. The snapshot is consumed by `get_foreground_app_context`.
    if let Some(state) = app.try_state::<Arc<AppState>>() {
        let name = state.processes.foreground_process_name();
        *state.last_foreground_at_tray_open.lock() = name;
    }

    let Some(win) = app.get_webview_window(PANEL_LABEL) else {
        return;
    };

    if PANEL_MEASURED.load(Ordering::SeqCst) {
        // Fast path: the window already holds the real content size from a
        // previous measurement, so it can be positioned and shown directly.
        position_panel_at_cursor(app, &win);
        crate::webview_memory::set_backgrounded(&win, false);
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    // Slow path (first open after launch): the window still has its
    // configured default size, and a hidden WebView never lays out, so the
    // frontend cannot have measured the content yet. Showing it at that size
    // would flash the panel at the wrong position before the ResizeObserver
    // corrects it. Instead, show it off-screen so the WebView can lay out;
    // the first `resize_tray_panel` call then moves it to the anchor
    // position and reveals it.
    PANEL_PENDING_REVEAL.store(true, Ordering::SeqCst);
    // Park the window far off-screen. Avoid (-32000, -32000): Windows uses
    // that exact coordinate as the "minimized" sentinel, which would keep
    // the WebView from laying out and block the measurement we depend on.
    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition {
        x: -20000,
        y: -20000,
    }));
    crate::webview_memory::set_backgrounded(&win, false);
    let _ = win.show();
}

/// Hide the tray panel window.
fn hide_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    // A pending reveal means the panel was shown off-screen waiting for its
    // first measurement; the user dismissed it before that arrived, so drop
    // the pending state — the next open retries the slow path.
    PANEL_PENDING_REVEAL.store(false, Ordering::SeqCst);
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        let _ = win.hide();
        crate::webview_memory::set_backgrounded(&win, true);
    }
}

pub fn init<R: Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let enabled = state.enabled.load(std::sync::atomic::Ordering::Relaxed);

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon_for(app, enabled))
        .show_menu_on_left_click(false)
        .on_tray_icon_event({
            let app = app.clone();
            let state = state.clone();
            move |_tray, event| {
                match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        // Left-click on Windows/Linux toggles enabled. On
                        // macOS we intentionally ignore the single Left-Up:
                        // the tray driver delivers BOTH Click { Up } and
                        // DoubleClick for the same double-click gesture, and
                        // macOS only sends ONE Click-Up before the
                        // DoubleClick (not the two paired Ups that Windows
                        // emits, which cancel each other out). Handling
                        // single Left-Up on macOS would flip the enabled
                        // flag every time the user double-clicks to open
                        // settings. macOS users get a dedicated
                        // DoubleClick path below; the quick toggle is
                        // reachable via Right-click → tray panel.
                        if cfg!(target_os = "macos") {
                            return;
                        }
                        let new_enabled = !state.enabled.load(std::sync::atomic::Ordering::Relaxed);
                        state
                            .enabled
                            .store(new_enabled, std::sync::atomic::Ordering::Relaxed);
                        state.engine_signal.signal();
                        crate::commands::emit_enabled_changed(&app, new_enabled);

                        // Keep the rest of the app in sync (e.g. TrayPanel polling)
                        // by emitting the full settings snapshot, matching `set_enabled`.
                        let current = state.settings.read().clone();
                        crate::commands::emit_settings_changed(&app, &current);

                        if let Some(tray) = app.tray_by_id(TRAY_ID) {
                            let _ = tray.set_icon(Some(icon_for(&app, new_enabled)));
                        }
                        tracing::info!(enabled = new_enabled, "tray left-click toggled");
                    }
                    TrayIconEvent::Click {
                        button: MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        // Right-click: toggle panel
                        if let Some(win) = app.get_webview_window(PANEL_LABEL) {
                            if win.is_visible().unwrap_or(false) {
                                hide_tray_panel(&app);
                                return;
                            }
                        }
                        show_tray_panel(&app);
                    }
                    TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        // On macOS this is the only path to open settings
                        // (Left-Up is intentionally ignored above). On
                        // Windows/Linux the driver still emits the paired
                        // Click-Ups around this DoubleClick, so this branch
                        // fires AFTER both ups have cancelled out.
                        if let Some(win) = app.get_webview_window("main") {
                            crate::webview_memory::set_backgrounded(&win, false);
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                        tracing::info!("tray double-click opened main settings");
                    }
                    _ => {}
                }
            }
        })
        .build(app)?;

    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        crate::webview_memory::set_backgrounded(&win, true);
    }

    // Hide the panel when it loses focus (click outside)
    {
        let app_focus = app.clone();
        if let Some(win) = app.get_webview_window(PANEL_LABEL) {
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    hide_tray_panel(&app_focus);
                }
            });
        }
    }

    // Keep tray icon in sync with `enabled-changed` events.
    {
        let app_h = app.clone();
        app.listen("enabled-changed", move |event| {
            let new_enabled: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            if let Some(tray) = app_h.tray_by_id(TRAY_ID) {
                let _ = tray.set_icon(Some(icon_for(&app_h, new_enabled)));
            }
        });
    }

    Ok(())
}

/// Show the tray panel programmatically (called from frontend via command).
pub fn show_panel<R: Runtime>(app: &AppHandle<R>) {
    show_tray_panel(app);
}

/// Hide the tray panel programmatically.
pub fn hide_panel<R: Runtime>(app: &AppHandle<R>) {
    hide_tray_panel(app);
}
