import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import i18n from "i18next";
import { tauri, type AppSettings, type ScrollProfile, type ThemeMode } from "@/lib/tauri";
import { debounce } from "@/lib/debounce";
import { applyTheme } from "@/lib/theme";
import { toast } from "@/components/ui/toast";

interface SettingsStore {
  settings: AppSettings | null;
  defaults: AppSettings | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  patch: (patch: Partial<AppSettings>) => void;
  /** Replace the entire in-memory settings snapshot without persisting.
   *  Used by Compare mode to swap A/B without going through disk. */
  setAll: (snapshot: AppSettings) => void;
  saveNow: () => Promise<void>;
  /** Update only the in-memory `enabled` flag without persisting. Used by
   *  the `enabled-changed` event listener so tray/hotkey toggles propagate
   *  into the UI store immediately. */
  setEnabledFromEvent: (enabled: boolean) => void;
  /** Update only the in-memory `start_with_os` flag without persisting.
   *  Used by the `settings-changed` event listener so cross-panel toggles
   *  (Behavior ↔ Tray) stay in sync. */
  setStartWithOsFromEvent: (start_with_os: boolean) => void;

  // Profile management
  createProfile: (name: string) => Promise<ScrollProfile>;
  updateProfile: (profile: ScrollProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  assignAppProfile: (processName: string, profileId: string | null) => Promise<void>;
  unassignAppProfile: (processName: string) => Promise<void>;
  /** Cleanup stale __disabled__ entries for Windows native-smooth apps
   *  (legacy leftover from before seed_native_smooth_excludes became a no-op).
   *  No-op when auto_disable_windows_apps is true. */
  cleanupNativeDisabledApps: () => Promise<void>;
}

// 350ms debounce: covers a typical slider drag (~200-300ms) so a continuous
// drag persists exactly once. Memory state updates synchronously for instant
// UI feedback. See spec § 4 B3 for rationale.
const SAVE_DEBOUNCE_MS = 350;

// Counter-based invalidation for the debounced persist. Each `patch` bumps
// `persistCounter` and captures the value when scheduling the timer; if the
// counter has moved by the time the timer fires, the snapshot is stale
// (e.g. cleanupNativeDisabledApps already wrote a fresh one via saveNow)
// and the write is skipped. This avoids a stale debounced snapshot racing
// past a fresh explicit save.
let persistCounter = 0;

const debouncedPersist = debounce(async (settings: AppSettings, scheduledAt: number) => {
  if (scheduledAt !== persistCounter) return;
  try {
    await tauri.saveSettings(settings);
  } catch (e) {
    console.error("save_settings failed", e);
    toast.error(i18n.t("errors.save_failed"));
  }
}, SAVE_DEBOUNCE_MS);

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  defaults: null,
  loading: true,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [settings, defaults] = await Promise.all([
        tauri.getSettings(),
        tauri.getDefaultSettings(),
      ]);
      applyTheme(settings.theme);
      set({ settings, defaults, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  patch: (patch) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.theme && patch.theme !== current.theme) {
      applyTheme(patch.theme);
    }
    set({ settings: next });
    persistCounter++;
    const myCounter = persistCounter;
    debouncedPersist(next, myCounter);

    if (
      patch.auto_disable_windows_apps === false &&
      current.auto_disable_windows_apps === true
    ) {
      void (async () => {
        await get().cleanupNativeDisabledApps();
        persistCounter++;
        await get().saveNow();
      })();
    }
  },

  setAll: (snapshot) => {
    const current = get().settings;
    if (current && snapshot.theme !== current.theme) {
      applyTheme(snapshot.theme);
    }
    set({ settings: snapshot });
  },

  saveNow: async () => {
    const current = get().settings;
    if (!current) return;
    try {
      await tauri.saveSettings(current);
    } catch (e) {
      toast.error(i18n.t("errors.save_failed"));
      throw e;
    }
  },

  setEnabledFromEvent: (enabled) => {
    const current = get().settings;
    if (!current) return;
    if (current.enabled === enabled) return;
    set({ settings: { ...current, enabled } });
  },

  setStartWithOsFromEvent: (start_with_os) => {
    const current = get().settings;
    if (!current) return;
    if (current.start_with_os === start_with_os) return;
    set({ settings: { ...current, start_with_os } });
  },

  createProfile: async (name) => {
    const profile = await tauri.createProfile(name);
    const current = get().settings;
    if (current) {
      set({ settings: { ...current, profiles: [...current.profiles, profile] } });
    }
    return profile;
  },

  updateProfile: async (profile) => {
    await tauri.updateProfile(profile);
    const current = get().settings;
    if (current) {
      const profiles = current.profiles.map((p) => (p.id === profile.id ? profile : p));
      set({ settings: { ...current, profiles } });
    }
  },

  deleteProfile: async (profileId) => {
    await tauri.deleteProfile(profileId);
    const current = get().settings;
    if (current) {
      const profiles = current.profiles.filter((p) => p.id !== profileId);
      set({ settings: { ...current, profiles } });
    }
  },

  assignAppProfile: async (processName, profileId) => {
    await tauri.assignAppProfile(processName, profileId);
    const current = get().settings;
    if (current) {
      const app_profiles = { ...current.app_profiles };
      if (profileId === null) {
        delete app_profiles[processName];
      } else {
        app_profiles[processName] = profileId;
      }
      set({ settings: { ...current, app_profiles } });
    }
  },

  unassignAppProfile: async (processName) => {
    await tauri.unassignAppProfile(processName);
    const current = get().settings;
    if (current) {
      const app_profiles = { ...current.app_profiles };
      delete app_profiles[processName];
      set({ settings: { ...current, app_profiles } });
    }
  },

  cleanupNativeDisabledApps: async () => {
    const current = get().settings;
    if (!current || current.auto_disable_windows_apps) return;
    const NATIVE_SEED = [
      "Notepad.exe",
      "SystemSettings.exe",
      "ApplicationFrameHost.exe",
      "CalculatorApp.exe",
      "Photos.exe",
      "WinStore.App.exe",
      "msedge.exe",
    ];
    for (const app of NATIVE_SEED) {
      if (current.app_profiles[app] === "__disabled__") {
        try {
          await get().unassignAppProfile(app);
        } catch (e) {
          console.error("cleanupNativeDisabledApps failed for", app, e);
        }
      }
    }
  },
}));

// =============================================================================
// Narrow selectors
// =============================================================================

export const useEnabled = () =>
  useSettingsStore((s) => s.settings?.enabled ?? false);

export const useTheme = (): ThemeMode =>
  useSettingsStore((s) => s.settings?.theme ?? "System");

export const useDefaults = () =>
  useSettingsStore((s) => s.defaults);

export const useScrollFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        step_size_px: set.step_size_px,
        animation_time_ms: set.animation_time_ms,
        acceleration_delta_ms: set.acceleration_delta_ms,
        acceleration_max: set.acceleration_max,
        tail_to_head_ratio: set.tail_to_head_ratio,
      };
    })
  );

export const useAppearanceFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        animation_easing: set.animation_easing,
        easing_mode: set.easing_mode,
        tail_to_head_ratio: set.tail_to_head_ratio,
      };
    })
  );

export const useDirectionFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        reverse_wheel_direction: set.reverse_wheel_direction,
        horizontal_smoothness: set.horizontal_smoothness,
        horizontal_invert: set.horizontal_invert,
        smooth_zoom: set.smooth_zoom,
        zoom_invert: set.zoom_invert,
      };
    })
  );

export const useTouchpadFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        touchpad_smoothing_enabled: set.touchpad_smoothing_enabled,
        touchpad_pixel_multiplier: set.touchpad_pixel_multiplier,
        touchpad_acceleration_factor: set.touchpad_acceleration_factor,
      };
    })
  );

export const useBehaviorFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        enable_global_hotkey: set.enable_global_hotkey,
        hotkey_accelerator: set.hotkey_accelerator,
        start_with_os: set.start_with_os,
        start_minimized: set.start_minimized,
        show_tray_icon_state: set.show_tray_icon_state,
        respect_reduce_motion: set.respect_reduce_motion,
        auto_disable_windows_apps: set.auto_disable_windows_apps,
      };
    })
  );

export const useGameModeFields = () =>
  useSettingsStore(
    useShallow((s) => {
      const set = s.settings;
      if (!set) return null;
      return {
        game_mode_enabled: set.game_mode_enabled,
        game_mode_known_apps: set.game_mode_known_apps,
      };
    })
  );
