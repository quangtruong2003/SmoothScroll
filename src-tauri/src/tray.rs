//! System tray icon.
//!
//! - Left-click: toggle enabled/disabled
//! - Right-click: show the floating tray-panel window at cursor position
//!
//! The panel is a frameless WebView window rendered via React.

use crate::state::AppState;
use std::sync::Arc;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Listener, Manager, Runtime, PhysicalPosition,
};

const TRAY_ID: &str = "main";
const PANEL_LABEL: &str = "tray-panel";

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

/// Get the current cursor position. Falls back to center of primary monitor
/// if unavailable.
fn cursor_position() -> PhysicalPosition<i32> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        use windows::Win32::Foundation::POINT;
        let mut point = POINT::default();
        unsafe {
            if GetCursorPos(&mut point).is_ok() {
                return PhysicalPosition::new(point.x, point.y);
            }
        }
        PhysicalPosition::new(960, 540)
    }
    #[cfg(not(windows))]
    {
        PhysicalPosition::new(960, 540)
    }
}

/// Position the panel window near the cursor, clamped to the primary monitor.
fn position_panel_at_cursor<R: Runtime>(app: &AppHandle<R>, win: &tauri::WebviewWindow<R>) {
    let cursor = cursor_position();
    let panel_w = 300;
    let panel_h = 440;

    let screen_w = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.work_area().size.width as i32)
        .unwrap_or(1920);
    let screen_h = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.work_area().size.height as i32)
        .unwrap_or(1080);
    let work_y = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.work_area().position.y)
        .unwrap_or(0);

    // Position: center horizontally at cursor, offset slightly upward
    let mut x = cursor.x - panel_w / 2;
    let mut y = cursor.y - 20;

    // Clamp to screen bounds
    if x + panel_w > screen_w {
        x = screen_w - panel_w - 8;
    }
    if x < 0 {
        x = 8;
    }
    if y + panel_h > screen_h + work_y {
        y = screen_h + work_y - panel_h - 8;
    }
    if y < work_y {
        y = work_y + 8;
    }

    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
}

/// Show the tray panel window at the cursor position.
fn show_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        position_panel_at_cursor(app, &win);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Hide the tray panel window.
fn hide_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        let _ = win.hide();
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
                        // Left-click: toggle enabled
                        let new_enabled = !state.enabled.load(std::sync::atomic::Ordering::Relaxed);
                        state.enabled.store(new_enabled, std::sync::atomic::Ordering::Relaxed);
                        state.engine_signal.signal();
                        crate::commands::emit_enabled_changed(&app, new_enabled);

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
                                let _ = win.hide();
                                return;
                            }
                        }
                        show_tray_panel(&app);
                    }
                    _ => {}
                }
            }
        })
        .build(app)?;

    // Hide the panel when it loses focus (click outside)
    {
        let app_focus = app.clone();
        if let Some(win) = app.get_webview_window(PANEL_LABEL) {
            let win_hide = win.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = win_hide.hide();
                    let _ = app_focus;
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
