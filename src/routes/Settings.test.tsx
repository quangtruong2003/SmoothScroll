// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AppSettings } from "@/lib/tauri";

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (event: { payload: unknown }) => void>();
  return {
    listeners,
    listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => void) => {
      listeners.set(eventName, handler);
      return Promise.resolve(() => {});
    }),
  };
});

vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/theme", () => ({ applyTheme: vi.fn(), watchSystemTheme: () => () => {} }));
vi.mock("@/lib/tauri", () => ({ tauri: { skipOnboarding: vi.fn() } }));
vi.mock("@/lib/localStats", () => ({ bumpSession: vi.fn() }));
vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({ onChange }: { onChange: (tab: "apps") => void }) => (
    <button onClick={() => onChange("apps")}>apps</button>
  ),
}));
vi.mock("@/components/WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("@/components/settings/EnableHeader", () => ({ EnableHeader: () => null }));
vi.mock("@/components/settings/AdvancedScrollSection", () => ({ AdvancedScrollSection: () => null }));
vi.mock("@/components/settings/AppearanceSection", () => ({ AppearanceSection: () => null }));
vi.mock("@/components/settings/DirectionSection", () => ({ DirectionSection: () => null }));
vi.mock("@/components/settings/TouchpadSection", () => ({ TouchpadSection: () => null }));
vi.mock("@/components/settings/ProfilesSection", () => ({ ProfilesSection: () => null }));
vi.mock("@/components/settings/MonitorProfiles", () => ({ MonitorProfiles: () => null }));
vi.mock("@/components/settings/BehaviorSection", () => ({ BehaviorSection: () => null }));
vi.mock("@/components/settings/GameModeSection", () => ({ GameModeSection: () => null }));
vi.mock("@/components/settings/AboutSection", () => ({ AboutSection: () => null }));
vi.mock("@/components/settings/BackupSection", () => ({ BackupSection: () => null }));
vi.mock("@/components/settings/TabContent", () => ({ TabContent: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/onboarding/OnboardingWizard", () => ({ OnboardingWizard: () => null }));
vi.mock("@/components/CheatSheetOverlay", () => ({ CheatSheetOverlay: () => null }));
vi.mock("@/components/WhatsNewModal", () => ({ WhatsNewModal: () => null }));
vi.mock("@/components/BatteryHint", () => ({ BatteryHint: () => null }));

import { SettingsPage } from "./Settings";

const settings: AppSettings = {
  enabled: true,
  step_size_px: 10,
  animation_time_ms: 200,
  max_velocity: 20,
  acceleration_max: 5,
  tail_to_head_ratio: 1,
  animation_easing: true,
  easing_mode: "CubicOut",
  horizontal_smoothness: true,
  horizontal_invert: false,
  reverse_wheel_direction: false,
  direction_sync_enabled: false,
  start_with_os: true,
  start_minimized: false,
  language: "en",
  theme: "System",
  enable_global_hotkey: false,
  hotkey_accelerator: "",
  show_tray_icon_state: true,
  excluded_apps: [],
  profiles: [{
    id: "fast",
    name: "Fast",
    step_size_px: 10,
    animation_time_ms: 200,
    max_velocity: 20,
    acceleration_max: 5,
    tail_to_head_ratio: 1,
    animation_easing: true,
    easing_mode: "CubicOut",
    reverse_wheel_direction: false,
    horizontal_smoothness: true,
    smooth_zoom: true,
    zoom_invert: false,
    zoom_sensitivity: 1,
  }],
  app_profiles: { "Notepad.exe": "fast" },
  game_mode_enabled: false,
  game_mode_known_apps: [],
  edge_scroll_enabled: false,
  edge_scroll_zone_px: 20,
  edge_scroll_max_notches_per_sec: 10,
  edge_scroll_modifier_required: false,
  edge_scroll_modifier: "",
  touchpad_smoothing_enabled: false,
  touchpad_pixel_multiplier: 1,
  touchpad_acceleration_factor: 1,
  respect_reduce_motion: "Auto",
  modifier_passthrough: { ctrl: false, alt: false, clear_inertia_on_press: false },
  smooth_zoom: false,
  zoom_invert: false,
  zoom_sensitivity: 1,
  onboarding_completed_at: 1,
  auto_disable_windows_apps: true,
  monitor_profiles: [],
  force_enable_all_apps: false,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.listeners.clear();
    vi.clearAllMocks();
    useSettingsStore.setState({
      settings,
      defaults: settings,
      loading: false,
      error: null,
      load: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("replaces visible app profile assignments from settings-changed", async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "apps" }));
    expect(screen.getByText("Notepad.exe")).toBeTruthy();

    const next = { ...settings, app_profiles: { "Chrome.exe": "fast" } };
    await act(async () => {
      mocks.listeners.get("settings-changed")?.({ payload: next });
    });

    expect(useSettingsStore.getState().settings?.app_profiles).toEqual({ "Chrome.exe": "fast" });
    expect(screen.queryByText("Notepad.exe")).toBeNull();
    expect(screen.getByText("Chrome.exe")).toBeTruthy();
  });
});
