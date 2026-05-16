import { invoke } from "@tauri-apps/api/core";

export type EasingMode =
  | "ExponentialOut"
  | "CubicOut"
  | "QuinticOut"
  | "Linear";

export type ThemeMode = "Light" | "Dark" | "System";

export interface AppSettings {
  enabled: boolean;
  step_size_px: number;
  animation_time_ms: number;
  acceleration_delta_ms: number;
  acceleration_max: number;
  tail_to_head_ratio: number;
  animation_easing: boolean;
  easing_mode: EasingMode;
  shift_key_horizontal: boolean;
  horizontal_smoothness: boolean;
  reverse_wheel_direction: boolean;
  start_with_os: boolean;
  start_minimized: boolean;
  language: string;
  theme: ThemeMode;
  enable_global_hotkey: boolean;
  hotkey_accelerator: string;
  show_tray_icon_state: boolean;
  excluded_apps: string[];
}

export interface ProcessInfo {
  pid: number;
  name: string;
  window_title: string;
}

export const tauri = {
  ping: () => invoke<string>("ping"),

  getEnabled: () => invoke<boolean>("get_enabled"),
  setEnabled: (enabled: boolean) => invoke<void>("set_enabled", { enabled }),

  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),

  setHotkeyEnabled: (enabled: boolean) =>
    invoke<void>("set_hotkey_enabled", { enabled }),
  setHotkeyAccelerator: (accelerator: string) =>
    invoke<void>("set_hotkey_accelerator", { accelerator }),

  listRunningProcesses: () => invoke<ProcessInfo[]>("list_running_processes"),
  addExcludedApp: (name: string) =>
    invoke<void>("add_excluded_app", { name }),
  removeExcludedApp: (name: string) =>
    invoke<void>("remove_excluded_app", { name }),

  getAutostart: () => invoke<boolean>("get_autostart"),
  setAutostart: (enabled: boolean) =>
    invoke<void>("set_autostart", { enabled }),
  changeLanguage: (lang: string) =>
    invoke<void>("change_language", { lang }),

  accessibilityStatus: () => invoke<boolean>("accessibility_status"),
  accessibilityRequestPrompt: () =>
    invoke<boolean>("accessibility_request_prompt"),

  appVersion: () => invoke<string>("app_version"),
  openLogDir: () => invoke<void>("open_log_dir"),
};
