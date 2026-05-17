import { create } from "zustand";
import { tauri, type AppSettings, type ScrollProfile } from "@/lib/tauri";
import { debounce } from "@/lib/debounce";
import { applyTheme } from "@/lib/theme";

interface SettingsStore {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  patch: (patch: Partial<AppSettings>) => void;
  saveNow: () => Promise<void>;
  /** Update only the in-memory `enabled` flag without persisting. Used by
   *  the `enabled-changed` event listener so tray/hotkey toggles propagate
   *  into the UI store immediately. */
  setEnabledFromEvent: (enabled: boolean) => void;

  // Profile management
  createProfile: (name: string) => Promise<ScrollProfile>;
  updateProfile: (profile: ScrollProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  assignAppProfile: (processName: string, profileId: string | null) => Promise<void>;
  unassignAppProfile: (processName: string) => Promise<void>;
}

const SAVE_DEBOUNCE_MS = 250;

const debouncedPersist = debounce(async (settings: AppSettings) => {
  try {
    await tauri.saveSettings(settings);
  } catch (e) {
    console.error("save_settings failed", e);
  }
}, SAVE_DEBOUNCE_MS);

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  loading: true,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await tauri.getSettings();
      applyTheme(settings.theme);
      set({ settings, loading: false });
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
    debouncedPersist(next);
  },

  saveNow: async () => {
    const current = get().settings;
    if (!current) return;
    await tauri.saveSettings(current);
  },

  setEnabledFromEvent: (enabled) => {
    const current = get().settings;
    if (!current) return;
    if (current.enabled === enabled) return;
    set({ settings: { ...current, enabled } });
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
}));
