import { create } from "zustand";
import { AppSettings, defaultSettings } from "@/lib/settings";

interface SettingsStore {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  addExcludedApp: (app: string) => void;
  removeExcludedApp: (app: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),
  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
  addExcludedApp: (app) =>
    set((state) => ({
      settings: {
        ...state.settings,
        excludedApps: [...state.settings.excludedApps, app],
      },
    })),
  removeExcludedApp: (app) =>
    set((state) => ({
      settings: {
        ...state.settings,
        excludedApps: state.settings.excludedApps.filter((a) => a !== app),
      },
    })),
}));
