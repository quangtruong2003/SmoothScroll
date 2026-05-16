//! System tray icon. Single-click opens the settings window; right-click
//! shows menu with Enable toggle + Open Settings + Exit.

use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

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

pub fn init<R: Runtime>(app: &AppHandle<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let lang = state.settings.read().language.clone();
    let labels = TrayLabels::for_lang(&lang);
    let menu = build_menu(app, state.enabled.load(Ordering::Relaxed), &labels)?;

    let _tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(
            app.default_window_icon()
                .cloned()
                .unwrap_or_else(|| unreachable!("default window icon missing")),
        )
        .on_menu_event({
            let state = state.clone();
            let app = app.clone();
            move |_app, event| match event.id().as_ref() {
                "enable" => {
                    let new_state = !state.enabled.load(Ordering::Relaxed);
                    state.enabled.store(new_state, Ordering::Relaxed);
                    state.engine_signal.signal();
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

    Ok(())
}
