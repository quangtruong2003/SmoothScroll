//! Game-mode poll thread. On Windows, the 1 Hz tick activates only for known-game
//! foreground processes. Other platforms retain the existing fullscreen/known-game
//! policy. Emits `game-mode-changed` to the frontend on transitions.

use crate::state::AppState;
use smoothscroll_core::settings::AppSettings;
#[cfg(target_os = "windows")]
use smoothscroll_platform::traits::ProcessInfo;
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

fn matches_known_game(settings: &AppSettings, process_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let process_name = AppSettings::canonicalize_process_name(process_name);
        if process_name.is_empty() {
            return false;
        }

        return settings
            .game_mode_known_apps
            .iter()
            .any(|game| AppSettings::canonicalize_process_name(game) == process_name);
    }

    #[cfg(not(target_os = "windows"))]
    {
        settings
            .game_mode_known_apps
            .iter()
            .any(|game| game.eq_ignore_ascii_case(process_name))
    }
}

#[cfg(target_os = "windows")]
fn known_game_pid_from_info(settings: &AppSettings, info: Option<ProcessInfo>) -> Option<u32> {
    let info = info?;
    matches_known_game(settings, &info.name).then_some(info.pid)
}

#[cfg(target_os = "windows")]
fn game_mode_active_from_known_game_pid(known_game_pid: Option<u32>) -> bool {
    known_game_pid.is_some()
}

fn run<R: Runtime>(app: AppHandle<R>, state: Arc<AppState>) {
    let mut last_fg_pid = 0u32;
    #[cfg(not(target_os = "windows"))]
    let mut last_known_game = false;
    #[cfg(target_os = "windows")]
    let mut last_known_game_pid = None;
    let mut last_active = false;

    loop {
        thread::sleep(Duration::from_secs(1));

        let s = state.settings.read();
        if !s.game_mode_enabled {
            drop(s);
            state.publish_game_mode_state(false, None);
            if last_active {
                let _ = app.emit("game-mode-changed", false);
                last_active = false;
            }
            continue;
        }

        let fg_pid = state.processes.foreground_process_id().unwrap_or(0);

        let now_active = if fg_pid == last_fg_pid {
            #[cfg(target_os = "windows")]
            {
                game_mode_active_from_known_game_pid(last_known_game_pid)
            }
            #[cfg(not(target_os = "windows"))]
            {
                state.fullscreen_detector.is_foreground_fullscreen() || last_known_game
            }
        } else {
            // PID changed: resolve process identity on the 1 Hz poll thread only.
            // This potentially heavier lookup never runs inside the wheel hook.
            last_fg_pid = fg_pid;
            #[cfg(target_os = "windows")]
            {
                last_known_game_pid =
                    known_game_pid_from_info(&s, state.processes.foreground_process_info());
                game_mode_active_from_known_game_pid(last_known_game_pid)
            }
            #[cfg(not(target_os = "windows"))]
            {
                let fg_name = state
                    .processes
                    .foreground_process_name()
                    .unwrap_or_default();
                last_known_game = matches_known_game(&s, &fg_name);
                state.fullscreen_detector.is_foreground_fullscreen() || last_known_game
            }
        };
        drop(s);

        #[cfg(target_os = "windows")]
        let known_game_pid = last_known_game_pid;
        #[cfg(not(target_os = "windows"))]
        let known_game_pid = None;
        state.publish_game_mode_state(now_active, known_game_pid);

        if now_active != last_active {
            let _ = app.emit("game-mode-changed", now_active);
            tracing::info!(active = now_active, "game mode toggled");
            last_active = now_active;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use smoothscroll_core::settings::AppSettings;

    #[cfg(target_os = "windows")]
    #[test]
    fn known_game_matching_accepts_extensionless_exe_and_case_variants() {
        let settings = AppSettings::default();

        for process_name in ["cs2", "CS2.EXE", "Cs2"] {
            assert!(
                matches_known_game(&settings, process_name),
                "expected default known-game list to match {process_name}"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn known_game_pid_comes_from_the_same_process_info_as_the_matched_name() {
        let settings = AppSettings::default();
        let info = smoothscroll_platform::traits::ProcessInfo {
            pid: 4242,
            name: "cs2".into(),
            window_title: String::new(),
            exe_path: None,
        };

        assert_eq!(known_game_pid_from_info(&settings, Some(info)), Some(4242));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn game_mode_activation_depends_only_on_known_game_identity() {
        assert!(!game_mode_active_from_known_game_pid(None));
        assert!(game_mode_active_from_known_game_pid(Some(4242)));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn known_game_matching_preserves_non_windows_exact_name_behavior() {
        let mut settings = AppSettings::default();
        settings.game_mode_known_apps = vec!["Example.exe".into()];

        assert!(matches_known_game(&settings, "EXAMPLE.EXE"));
        assert!(!matches_known_game(&settings, "example"));
    }
}
