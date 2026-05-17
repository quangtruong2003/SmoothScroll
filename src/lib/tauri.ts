import { invoke } from "@tauri-apps/api/core";

export type EasingMode =
  | "ExponentialOut"
  | "CubicOut"
  | "QuinticOut"
  | "Linear";

export type ThemeMode = "Light" | "Dark" | "System";

export interface ScrollProfile {
  id: string;
  name: string;
  step_size_px: number;
  animation_time_ms: number;
  acceleration_delta_ms: number;
  acceleration_max: number;
  tail_to_head_ratio: number;
  animation_easing: boolean;
  easing_mode: EasingMode;
  reverse_wheel_direction: boolean;
  horizontal_smoothness: boolean;
}

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
  profiles: ScrollProfile[];
  app_profiles: Record<string, string>;
  edge_scroll_enabled: boolean;
  edge_scroll_zone_px: number;
  edge_scroll_max_notches_per_sec: number;
  edge_scroll_modifier_required: boolean;
  edge_scroll_modifier: string;
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

  openTrayPanel: () => invoke<void>("open_tray_panel"),
  closeTrayPanel: () => invoke<void>("close_tray_panel"),
  showMainWindow: () => invoke<void>("show_main_window"),
  navigateTo: (section: string) => invoke<void>("navigate_to", { section }),

  // Profile management
  listProfiles: () => invoke<ScrollProfile[]>("list_profiles"),
  createProfile: (name: string) => invoke<ScrollProfile>("create_profile", { name }),
  updateProfile: (profile: ScrollProfile) => invoke<void>("update_profile", { profile }),
  deleteProfile: (profileId: string) => invoke<void>("delete_profile", { profileId }),
  assignAppProfile: (processName: string, profileId: string | null) =>
    invoke<void>("assign_app_profile", { processName, profileId }),
  unassignAppProfile: (processName: string) =>
    invoke<void>("unassign_app_profile", { processName }),
};
