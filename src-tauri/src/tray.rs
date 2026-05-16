//! System tray icon. Single-click opens the settings window; right-click
//! shows menu with Enable toggle + Open Settings + Exit.
//!
//! Listens to `enabled-changed` and `language-changed` events to keep the
//! menu state and labels in sync without restart.

use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Listener, Manager, Runtime};

const TRAY_ID: &str = "main";

pub struct TrayLabels {
    pub enabled: String,
    pub open_settings: String,
    pub exit: String,
}

impl TrayLabels {
    pub fn for_lang(lang: &str) -> Self {
        match lang {
            "vi" => Self {
                enabled: "Đang bật".into(),
                open_settings: "Mở cài đặt".into(),
                exit: "Thoát".into(),
            },
            "zh" => Self {
                enabled: "已启用".into(),
                open_settings: "打开设置".into(),
                exit: "退出".into(),
            },
            _ => Self {
                enabled: "Enabled".into(),
                open_settings: "Open Settings".into(),
                exit: "Exit".into(),
            },
        }
    }
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    enabled: bool,
    labels: &TrayLabels,
) -> tauri::Result<Menu<R>> {
    let toggle =
        CheckMenuItem::with_id(app, "enable", &labels.enabled, true, enabled, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", &labels.open_settings, true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", &labels.exit, true, None::<&str>)?;
    Menu::with_items(app, &[&toggle, &open, &exit])
}

/// Returns the tray icon image for the given enabled state. Falls back to
/// the default app icon if `tray-disabled.png` cannot be decoded.
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

pub fn init<R: Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let lang = state.settings.read().language.clone();
    let labels = TrayLabels::for_lang(&lang);
    let enabled = state.enabled.load(Ordering::Relaxed);
    let menu = build_menu(app, enabled, &labels)?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(icon_for(app, enabled))
        .on_menu_event({
            let state = state.clone();
            let app = app.clone();
            move |_app, event| match event.id().as_ref() {
                "enable" => {
                    let new_state = !state.enabled.load(Ordering::Relaxed);
                    state.enabled.store(new_state, Ordering::Relaxed);
                    state.engine_signal.signal();
                    crate::commands::emit_enabled_changed(&app, new_state);
                    tracing::info!(enabled = new_state, "tray toggled enabled");
                }
                "open" => {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
                "exit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event({
            let app = app.clone();
            move |_tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Keep tray icon and check-menu in sync with `enabled-changed` events.
    {
        let app_h = app.clone();
        let state_l = state.clone();
        app.listen("enabled-changed", move |event| {
            let new_enabled: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            state_l.enabled.store(new_enabled, Ordering::Relaxed);
            if let Some(tray) = app_h.tray_by_id(TRAY_ID) {
                let _ = tray.set_icon(Some(icon_for(&app_h, new_enabled)));
                rebuild_menu(&app_h, &state_l, &tray);
            }
        });
    }

    // Rebuild the menu with localized labels when language changes.
    {
        let app_h = app.clone();
        let state_l = state.clone();
        app.listen("language-changed", move |_event| {
            if let Some(tray) = app_h.tray_by_id(TRAY_ID) {
                rebuild_menu(&app_h, &state_l, &tray);
            }
        });
    }

    Ok(())
}

fn rebuild_menu<R: Runtime>(app: &AppHandle<R>, state: &Arc<AppState>, tray: &TrayIcon<R>) {
    let lang = state.settings.read().language.clone();
    let labels = TrayLabels::for_lang(&lang);
    let enabled = state.enabled.load(Ordering::Relaxed);
    if let Ok(menu) = build_menu(app, enabled, &labels) {
        let _ = tray.set_menu(Some(menu));
    }
}
