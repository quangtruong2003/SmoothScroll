import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { useSettingsStore } from "./settingsStore";
import type { AppSettings, ScrollProfile } from "@/lib/tauri";

// Use vi.hoisted to define mocks outside vi.mock factories
const mocks = vi.hoisted(() => {
  const mockGetSettings = vi.fn();
  const mockGetDefaultSettings = vi.fn();
  const mockSaveSettings = vi.fn();
  const mockCreateProfile = vi.fn();
  const mockUpdateProfile = vi.fn();
  const mockDeleteProfile = vi.fn();
  const mockAssignAppProfile = vi.fn();
  const mockUnassignAppProfile = vi.fn();
  const mockApplyTheme = vi.fn();
  const mockToastError = vi.fn();

  return {
    mockGetSettings,
    mockGetDefaultSettings,
    mockSaveSettings,
    mockCreateProfile,
    mockUpdateProfile,
    mockDeleteProfile,
    mockAssignAppProfile,
    mockUnassignAppProfile,
    mockApplyTheme,
    mockToastError,
  };
});

vi.mock("@/lib/tauri", () => ({
  tauri: {
    getSettings: mocks.mockGetSettings,
    getDefaultSettings: mocks.mockGetDefaultSettings,
    saveSettings: mocks.mockSaveSettings,
    createProfile: mocks.mockCreateProfile,
    updateProfile: mocks.mockUpdateProfile,
    deleteProfile: mocks.mockDeleteProfile,
    assignAppProfile: mocks.mockAssignAppProfile,
    unassignAppProfile: mocks.mockUnassignAppProfile,
  },
}));

vi.mock("@/lib/theme", () => ({
  applyTheme: mocks.mockApplyTheme,
}));

vi.mock("i18next", () => ({
  default: { t: (key: string) => key },
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { error: mocks.mockToastError },
}));

const mockSettings: AppSettings = {
  enabled: true,
  step_size_px: 10,
  animation_time_ms: 200,
  acceleration_delta_ms: 100,
  acceleration_max: 5,
  tail_to_head_ratio: 1,
  animation_easing: true,
  easing_mode: "CubicOut",
  horizontal_smoothness: true,
  horizontal_invert: false,
  reverse_wheel_direction: false,
  start_with_os: true,
  start_minimized: false,
  language: "en",
  theme: "System",
  enable_global_hotkey: false,
  hotkey_accelerator: "",
  show_tray_icon_state: true,
  excluded_apps: [],
  profiles: [],
  app_profiles: {},
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
  onboarding_completed_at: null,
  auto_disable_windows_apps: true,
};

const mockDefaults: AppSettings = {
  ...mockSettings,
  enabled: false,
};

const mockProfile: ScrollProfile = {
  id: "profile-1",
  name: "Test Profile",
  step_size_px: 15,
  animation_time_ms: 150,
  acceleration_delta_ms: 80,
  acceleration_max: 4,
  tail_to_head_ratio: 1,
  animation_easing: true,
  easing_mode: "QuinticOut",
  reverse_wheel_direction: false,
  horizontal_smoothness: true,
};

describe("settingsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetSettings.mockResolvedValue(mockSettings);
    mocks.mockGetDefaultSettings.mockResolvedValue(mockDefaults);
    mocks.mockSaveSettings.mockResolvedValue(undefined);
    mocks.mockCreateProfile.mockResolvedValue(mockProfile);
    mocks.mockUpdateProfile.mockResolvedValue(undefined);
    mocks.mockDeleteProfile.mockResolvedValue(undefined);
    mocks.mockAssignAppProfile.mockResolvedValue(undefined);
    mocks.mockUnassignAppProfile.mockResolvedValue(undefined);

    useSettingsStore.setState({
      settings: null,
      defaults: null,
      loading: true,
      error: null,
    });
  });

  describe("load", () => {
    it("loads settings and defaults successfully", async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });

      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(mockSettings);
      expect(state.defaults).toEqual(mockDefaults);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it("applies theme when loading", async () => {
      const settingsWithDarkTheme = { ...mockSettings, theme: "Dark" as const };
      mocks.mockGetSettings.mockResolvedValue(settingsWithDarkTheme);

      await act(async () => {
        await useSettingsStore.getState().load();
      });

      expect(mocks.mockApplyTheme).toHaveBeenCalledWith("Dark");
    });

    it("handles load failure", async () => {
      mocks.mockGetSettings.mockRejectedValue(new Error("Failed to load"));

      await act(async () => {
        await useSettingsStore.getState().load();
      });

      const state = useSettingsStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe("Error: Failed to load");
      expect(state.settings).toBe(null);
    });
  });

  describe("patch", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("updates single setting", async () => {
      await act(async () => {
        useSettingsStore.getState().patch({ enabled: false });
      });

      const state = useSettingsStore.getState();
      expect(state.settings?.enabled).toBe(false);
      expect(state.settings?.step_size_px).toBe(10);
    });

    it("updates multiple settings at once", async () => {
      await act(async () => {
        useSettingsStore.getState().patch({
          enabled: false,
          step_size_px: 20,
        });
      });

      const state = useSettingsStore.getState();
      expect(state.settings?.enabled).toBe(false);
      expect(state.settings?.step_size_px).toBe(20);
    });

    it("applies theme when theme changes via patch", async () => {
      await act(async () => {
        useSettingsStore.getState().patch({ theme: "Light" });
      });

      expect(mocks.mockApplyTheme).toHaveBeenCalledWith("Light");
    });
  });

  describe("setAll", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("replaces entire settings snapshot", async () => {
      const newSettings = { ...mockSettings, enabled: false, step_size_px: 50 };

      await act(async () => {
        useSettingsStore.getState().setAll(newSettings);
      });

      expect(useSettingsStore.getState().settings).toEqual(newSettings);
    });
  });

  describe("saveNow", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("saves current settings immediately", async () => {
      await act(async () => {
        await useSettingsStore.getState().saveNow();
      });

      expect(mocks.mockSaveSettings).toHaveBeenCalledWith(mockSettings);
    });

    it("throws and shows error toast on save failure", async () => {
      mocks.mockSaveSettings.mockRejectedValue(new Error("Save failed"));

      await expect(
        act(async () => {
          await useSettingsStore.getState().saveNow();
        })
      ).rejects.toThrow("Save failed");

      expect(mocks.mockToastError).toHaveBeenCalledWith("errors.save_failed");
    });
  });

  describe("setEnabledFromEvent", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("updates enabled flag from event", async () => {
      await act(async () => {
        useSettingsStore.getState().setEnabledFromEvent(false);
      });

      expect(useSettingsStore.getState().settings?.enabled).toBe(false);
    });

    it("ignores if value unchanged", async () => {
      await act(async () => {
        useSettingsStore.getState().setEnabledFromEvent(true);
      });

      expect(useSettingsStore.getState().settings?.enabled).toBe(true);
    });
  });

  describe("setStartWithOsFromEvent", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("updates start_with_os from event", async () => {
      await act(async () => {
        useSettingsStore.getState().setStartWithOsFromEvent(false);
      });

      expect(useSettingsStore.getState().settings?.start_with_os).toBe(false);
    });
  });

  describe("profile management", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    describe("createProfile", () => {
      it("creates profile and adds to list", async () => {
        const result = await act(async () => {
          return useSettingsStore.getState().createProfile("Test Profile");
        });

        expect(result).toEqual(mockProfile);
        expect(useSettingsStore.getState().settings?.profiles).toContainEqual(mockProfile);
      });
    });

    describe("updateProfile", () => {
      it("updates existing profile in list", async () => {
        const settingsWithProfile = {
          ...mockSettings,
          profiles: [mockProfile],
        };
        useSettingsStore.setState({ settings: settingsWithProfile });

        const updatedProfile = { ...mockProfile, name: "Updated Name" };

        await act(async () => {
          await useSettingsStore.getState().updateProfile(updatedProfile);
        });

        expect(mocks.mockUpdateProfile).toHaveBeenCalledWith(updatedProfile);
        expect(useSettingsStore.getState().settings?.profiles[0].name).toBe("Updated Name");
      });
    });

    describe("deleteProfile", () => {
      it("removes profile from list", async () => {
        const settingsWithProfile = {
          ...mockSettings,
          profiles: [mockProfile],
        };
        useSettingsStore.setState({ settings: settingsWithProfile });

        await act(async () => {
          await useSettingsStore.getState().deleteProfile("profile-1");
        });

        expect(useSettingsStore.getState().settings?.profiles).toHaveLength(0);
      });
    });

    describe("assignAppProfile", () => {
      it("assigns profile to app", async () => {
        await act(async () => {
          await useSettingsStore.getState().assignAppProfile("chrome.exe", "profile-1");
        });

        expect(mocks.mockAssignAppProfile).toHaveBeenCalledWith("chrome.exe", "profile-1");
        expect(useSettingsStore.getState().settings?.app_profiles["chrome.exe"]).toBe("profile-1");
      });

      it("removes assignment when profileId is null", async () => {
        const settingsWithAssignment = {
          ...mockSettings,
          app_profiles: { "chrome.exe": "profile-1" },
        };
        useSettingsStore.setState({ settings: settingsWithAssignment });

        await act(async () => {
          await useSettingsStore.getState().assignAppProfile("chrome.exe", null);
        });

        expect(useSettingsStore.getState().settings?.app_profiles["chrome.exe"]).toBeUndefined();
      });
    });

    describe("unassignAppProfile", () => {
      it("removes app profile assignment", async () => {
        const settingsWithAssignment = {
          ...mockSettings,
          app_profiles: { "chrome.exe": "profile-1" },
        };
        useSettingsStore.setState({ settings: settingsWithAssignment });

        await act(async () => {
          await useSettingsStore.getState().unassignAppProfile("chrome.exe");
        });

        expect(useSettingsStore.getState().settings?.app_profiles["chrome.exe"]).toBeUndefined();
      });
    });
  });

  describe("selector hooks return correct data", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("useEnabled returns enabled state", () => {
      const enabled = useSettingsStore.getState().settings?.enabled;
      expect(enabled).toBe(true);
    });

    it("useTheme returns current theme", () => {
      const theme = useSettingsStore.getState().settings?.theme;
      expect(theme).toBe("System");
    });

    it("useScrollFields returns scroll fields", () => {
      const state = useSettingsStore.getState();
      expect(state.settings?.step_size_px).toBe(10);
      expect(state.settings?.animation_time_ms).toBe(200);
    });

    it("useBehaviorFields returns behavior fields", () => {
      const state = useSettingsStore.getState();
      expect(state.settings?.enable_global_hotkey).toBe(false);
      expect(state.settings?.start_with_os).toBe(true);
    });

    it("useGameModeFields returns game mode fields", () => {
      const state = useSettingsStore.getState();
      expect(state.settings?.game_mode_enabled).toBe(false);
      expect(state.settings?.game_mode_known_apps).toEqual([]);
    });
  });

  describe("auto-disable Windows apps toggle cleanup", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("removes stale __disabled__ entries from NATIVE_SMOOTH_SEED apps on toggle OFF", async () => {
      const settingsWithStaleEntries = {
        ...mockSettings,
        auto_disable_windows_apps: true,
        app_profiles: {
          "Notepad.exe": "__disabled__",
          "SystemSettings.exe": "__disabled__",
          "chrome.exe": "profile-1",
        },
      };
      useSettingsStore.setState({ settings: settingsWithStaleEntries });

      await act(async () => {
        useSettingsStore.getState().patch({ auto_disable_windows_apps: false });
        await Promise.resolve();
      });

      expect(mocks.mockUnassignAppProfile).toHaveBeenCalledWith("Notepad.exe");
      expect(mocks.mockUnassignAppProfile).toHaveBeenCalledWith("SystemSettings.exe");
      expect(mocks.mockUnassignAppProfile).not.toHaveBeenCalledWith("chrome.exe");

      // After cleanup runs, the in-memory app_profiles must be clean.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });
      const finalSettings = useSettingsStore.getState().settings;
      expect(finalSettings?.app_profiles["Notepad.exe"]).toBeUndefined();
      expect(finalSettings?.app_profiles["SystemSettings.exe"]).toBeUndefined();
      expect(finalSettings?.app_profiles["chrome.exe"]).toBe("profile-1");
    });

    it("post-cleanup saveNow overwrites stale debounced snapshot", async () => {
      const settingsWithStaleEntries = {
        ...mockSettings,
        auto_disable_windows_apps: true,
        app_profiles: {
          "Notepad.exe": "__disabled__",
          "SystemSettings.exe": "__disabled__",
          "chrome.exe": "profile-1",
        },
      };
      useSettingsStore.setState({ settings: settingsWithStaleEntries });

      await act(async () => {
        useSettingsStore.getState().patch({ auto_disable_windows_apps: false });
      });

      // Flush microtasks so cleanup has run and saveNow has been awaited.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
      });

      // After cleanup runs, the in-memory app_profiles must be clean.
      const finalSettings = useSettingsStore.getState().settings;
      expect(finalSettings?.app_profiles["Notepad.exe"]).toBeUndefined();
      expect(finalSettings?.app_profiles["SystemSettings.exe"]).toBeUndefined();
      expect(finalSettings?.app_profiles["chrome.exe"]).toBe("profile-1");
    });
  });
});
