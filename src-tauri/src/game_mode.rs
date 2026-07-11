//! Game-mode poll thread. 1 Hz tick: detects fullscreen foreground or known-game
//! process and toggles `state.game_mode_active`. Emits `game-mode-changed` to
//! the frontend on transitions.

use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

pub fn spawn<R: Runtime>(app: AppHandle<R>, state: Arc<AppState>) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("ss-game-mode".into())
        .spawn(move || run(app, state))
        .expect("spawn game-mode thread")
}

fn run<R: Runtime>(app: AppHandle<R>, state: Arc<AppState>) {
    use std::sync::atomic::{AtomicBool, AtomicU32};

    let last_fg_pid: AtomicU32 = AtomicU32::new(0);
    let last_known_game: AtomicBool = AtomicBool::new(false);
    let mut last_active = false;

    loop {
        thread::sleep(Duration::from_secs(1));

        let s = state.settings.read();
        if !s.game_mode_enabled {
            drop(s);
            if last_active {
                state.game_mode_active.store(false, Ordering::Relaxed);
                let _ = app.emit("game-mode-changed", false);
                last_active = false;
            }
            continue;
        }

        let fg_pid = state.processes.foreground_process_id().unwrap_or(0);

        let now_active = if fg_pid == last_fg_pid.load(Ordering::Relaxed) {
            // PID unchanged: only re-check fullscreen (cheap — single HWND + monitor rect)
            let fullscreen = state.fullscreen_detector.is_foreground_fullscreen();
            let known = last_known_game.load(Ordering::Relaxed);
            fullscreen || known
        } else {
            // PID changed: resolve name via foreground_process_name (O(1) cached)
            last_fg_pid.store(fg_pid, Ordering::Relaxed);
            let fg_name = state
                .processes
                .foreground_process_name()
                .unwrap_or_default();
            let known = s
                .game_mode_known_apps
                .iter()
                .any(|g| g.eq_ignore_ascii_case(&fg_name));
            last_known_game.store(known, Ordering::Relaxed);
            let fullscreen = state.fullscreen_detector.is_foreground_fullscreen();
            fullscreen || known
        };
        drop(s);

        if now_active != last_active {
            state.game_mode_active.store(now_active, Ordering::Relaxed);
            let _ = app.emit("game-mode-changed", now_active);
            tracing::info!(active = now_active, "game mode toggled");
            last_active = now_active;
        }
    }
}
