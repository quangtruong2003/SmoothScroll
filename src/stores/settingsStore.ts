import { create } from "zustand";
import { tauri, type AppSettings } from "@/lib/tauri";
import { debounce } from "@/lib/debounce";

interface SettingsStore {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  patch: (patch: Partial<AppSettings>) => void;
  saveNow: () => Promise<void>;
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
      set({ settings, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  patch: (patch) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ settings: next });
    debouncedPersist(next);
  },

  saveNow: async () => {
    const current = get().settings;
    if (!current) return;
    await tauri.saveSettings(current);
  },
}));
