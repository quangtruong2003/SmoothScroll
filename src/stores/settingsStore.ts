import { create } from "zustand";
import { tauri, type AppSettings } from "@/lib/tauri";
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
}));
