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

        let foreground_pid = state.processes.foreground_process_id();
        let foreground_proc = foreground_pid.and_then(|pid| {
            state
                .processes
                .list_visible_processes()
                .into_iter()
                .find(|p| p.pid == pid)
                .map(|p| p.name)
        });
        let known_match = foreground_proc
            .as_ref()
            .map(|n| {
                s.game_mode_known_apps
                    .iter()
                    .any(|g| g.eq_ignore_ascii_case(n))
            })
            .unwrap_or(false);
        drop(s);

        let fs = state.fullscreen_detector.is_foreground_fullscreen();
        let now_active = fs || known_match;

        if now_active != last_active {
            state.game_mode_active.store(now_active, Ordering::Relaxed);
            let _ = app.emit("game-mode-changed", now_active);
            tracing::info!(
                active = now_active,
                fullscreen = fs,
                known = known_match,
                "game mode toggled"
            );
            last_active = now_active;
        }
    }
}
