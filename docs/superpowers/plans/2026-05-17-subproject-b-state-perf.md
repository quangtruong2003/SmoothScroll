# Sub-project B — State & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix root cause re-render và disk-thrash khi user kéo slider. UX outcome: kéo slider mượt, không lag, không nháy section khác; toast hiển thị khi save fail.

**Architecture:** (1) Selectors hẹp với `shallow` để mỗi Section chỉ re-render khi field nó dùng đổi. (2) IPC `get_default_settings` cho single-source-of-truth từ Rust core. (3) Tăng debounce payload-level lên 350ms (đã chốt trong spec § 4 B3, không per-field). (4) Toast Radix wired vào store error path. (5) `React.memo` các Section.

**Tech Stack:** Zustand 4 + `zustand/shallow`, React 18 (`memo`, `useMemo`), Radix Toast, Tauri 2 IPC, react-i18next.

**Spec reference:** `docs/superpowers/specs/2026-05-17-smoothscroll-ux-perf-overhaul-design.md` § 4 (Sub-project B).

---

## File Structure

**Files modified:**
- `src/stores/settingsStore.ts` — selectors hẹp, debounce 350ms, defaults cache, error path → toast
- `src/lib/tauri.ts` — thêm `getDefaultSettings`
- `src-tauri/src/commands.rs` — IPC `get_default_settings`
- `src-tauri/src/lib.rs` — register command
- `src/main.tsx` — mount `<Toaster />`
- `src/i18n/locales/{en,vi,zh}.json` — error key
- `src/components/settings/{Scroll,Appearance,Direction,EdgeScroll,KeyboardScroll,Touchpad,Behavior,GameMode}Section.tsx` — selector + memo
- `src/components/settings/EnableHeader.tsx` — `useEnabled`

**Files created:**
- `src/lib/toast.ts` — wrapper API
- `src/components/Toaster.tsx` — render toast list

---

## Task 1: Backend IPC `get_default_settings`

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Thêm command**

Thêm vào cuối `src-tauri/src/commands.rs`:

```rust
/// Returns the canonical default settings from `smoothscroll_core`.
/// Single source of truth for "Reset to default" actions in the UI.
#[tauri::command]
pub fn get_default_settings() -> AppSettings {
    AppSettings::default()
}
```

- [ ] **Step 2: Register trong invoke_handler**

Mở `src-tauri/src/lib.rs`. Trong `tauri::generate_handler![ ... ]`, thêm `commands::get_default_settings,` vào danh sách.

- [ ] **Step 3: cargo check**

Run: `cargo check --workspace`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): IPC get_default_settings for UI reset defaults"
```

---

## Task 2: Frontend `tauri.getDefaultSettings()`

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Thêm method**

Trong `src/lib/tauri.ts`, thêm vào object `tauri` (gần `getSettings`):

```typescript
getDefaultSettings: () => invoke<AppSettings>("get_default_settings"),
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat(ts): expose getDefaultSettings to frontend"
```

---

## Task 3: Toast wrapper + Toaster component

**Files:**
- Create: `src/lib/toast.ts`
- Create: `src/components/Toaster.tsx`
- Modify: `src/main.tsx`
- Modify: `src/i18n/locales/{en,vi,zh}.json`

- [ ] **Step 1: Thêm i18n keys**

Vào object `errors` cả 3 file locale:
- en: `"save_failed": "Failed to save settings. Changes are kept in memory but won't persist."`
- vi: `"save_failed": "Lưu cài đặt thất bại. Thay đổi vẫn còn trong bộ nhớ nhưng sẽ không được lưu."`
- zh: `"save_failed": "保存设置失败。更改保留在内存中但不会持久化。"`

- [ ] **Step 2: Tạo `src/lib/toast.ts`**

```typescript
import { create } from "zustand";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastStore {
  items: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 5000;

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => {
    const id = crypto.randomUUID();
    set((s) => ({ items: [...s.items, { id, ...t }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    }, t.durationMs);
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  error: (description: string, title?: string) =>
    useToastStore.getState().push({
      description,
      title,
      variant: "destructive",
      durationMs: DEFAULT_DURATION_MS,
    }),
  success: (description: string, title?: string) =>
    useToastStore.getState().push({
      description,
      title,
      variant: "success",
      durationMs: 3000,
    }),
};
```

- [ ] **Step 3: Tạo `src/components/Toaster.tsx`**

```tsx
import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-[200] flex w-80 flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.variant === "destructive" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto rounded-md border p-3 shadow-lg backdrop-blur",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            t.variant === "destructive" && "border-destructive/50 bg-destructive/10 text-destructive",
            t.variant === "success" && "border-green-500/50 bg-green-500/10",
            t.variant === "default" && "border-border bg-background",
          )}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-medium">{t.title}</p>}
              {t.description && <p className="text-xs opacity-90">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mount `<Toaster />` trong main.tsx**

Mở `src/main.tsx`. Thêm `<Toaster />` cạnh `<App />`:

```tsx
import { Toaster } from "./components/Toaster";

// inside ReactDOM.createRoot(...).render(...):
<>
  <App />
  <Toaster />
</>
```

- [ ] **Step 5: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/toast.ts src/components/Toaster.tsx src/main.tsx src/i18n/locales/*.json
git commit -m "feat(ui): toast notification system for save errors"
```

---

## Task 4: settingsStore — selectors hẹp + defaults cache + debounce 350ms + toast

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: Replace toàn bộ file**

```typescript
import { create } from "zustand";
import { shallow } from "zustand/shallow";
import { tauri, type AppSettings, type ScrollProfile, type ThemeMode } from "@/lib/tauri";
import { debounce } from "@/lib/debounce";
import { applyTheme } from "@/lib/theme";
import { toast } from "@/lib/toast";
import i18n from "@/i18n";

interface SettingsStore {
  settings: AppSettings | null;
  defaults: AppSettings | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  patch: (patch: Partial<AppSettings>) => void;
  saveNow: () => Promise<void>;
  setEnabledFromEvent: (enabled: boolean) => void;

  createProfile: (name: string) => Promise<ScrollProfile>;
  updateProfile: (profile: ScrollProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  assignAppProfile: (processName: string, profileId: string | null) => Promise<void>;
  unassignAppProfile: (processName: string) => Promise<void>;
}

// 350ms debounce: covers a typical slider drag (~200-300ms) so a continuous
// drag persists exactly once. Memory state updates synchronously for instant
// UI feedback. See spec § 4 B3 for rationale (per-key debounce rejected as
// over-engineering — root cause of re-render is selector breadth, not debounce).
const SAVE_DEBOUNCE_MS = 350;

const debouncedPersist = debounce(async (settings: AppSettings) => {
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
    debouncedPersist(next);
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

// =============================================================================
// Narrow selectors — each Section subscribes only to fields it reads.
// =============================================================================

export const useEnabled = () =>
  useSettingsStore((s) => s.settings?.enabled ?? false);

export const useTheme = (): ThemeMode =>
  useSettingsStore((s) => s.settings?.theme ?? "System");

export const useDefaults = () =>
  useSettingsStore((s) => s.defaults);

export const useScrollFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      step_size_px: set.step_size_px,
      animation_time_ms: set.animation_time_ms,
      acceleration_delta_ms: set.acceleration_delta_ms,
      acceleration_max: set.acceleration_max,
      tail_to_head_ratio: set.tail_to_head_ratio,
    };
  }, shallow);

export const useAppearanceFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      animation_easing: set.animation_easing,
      easing_mode: set.easing_mode,
      tail_to_head_ratio: set.tail_to_head_ratio,
    };
  }, shallow);

export const useDirectionFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      reverse_wheel_direction: set.reverse_wheel_direction,
      shift_key_horizontal: set.shift_key_horizontal,
      horizontal_smoothness: set.horizontal_smoothness,
    };
  }, shallow);

export const useEdgeScrollFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      edge_scroll_enabled: set.edge_scroll_enabled,
      edge_scroll_zone_px: set.edge_scroll_zone_px,
      edge_scroll_max_notches_per_sec: set.edge_scroll_max_notches_per_sec,
      edge_scroll_modifier_required: set.edge_scroll_modifier_required,
      edge_scroll_modifier: set.edge_scroll_modifier,
    };
  }, shallow);

export const useKeyboardFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      keyboard_scroll_enabled: set.keyboard_scroll_enabled,
      keyboard_scroll_keys: set.keyboard_scroll_keys,
      keyboard_smart_text_skip: set.keyboard_smart_text_skip,
      keyboard_pgdn_step_notches: set.keyboard_pgdn_step_notches,
      keyboard_arrow_step_notches: set.keyboard_arrow_step_notches,
    };
  }, shallow);

export const useTouchpadFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      touchpad_smoothing_enabled: set.touchpad_smoothing_enabled,
      touchpad_pixel_multiplier: set.touchpad_pixel_multiplier,
      touchpad_acceleration_factor: set.touchpad_acceleration_factor,
    };
  }, shallow);

export const useBehaviorFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      enable_global_hotkey: set.enable_global_hotkey,
      hotkey_accelerator: set.hotkey_accelerator,
      start_with_os: set.start_with_os,
      start_minimized: set.start_minimized,
      show_tray_icon_state: set.show_tray_icon_state,
    };
  }, shallow);

export const useGameModeFields = () =>
  useSettingsStore((s) => {
    const set = s.settings;
    if (!set) return null;
    return {
      game_mode_enabled: set.game_mode_enabled,
      game_mode_known_apps: set.game_mode_known_apps,
    };
  }, shallow);
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS hoặc errors chỉ ở Section components subscribing `(s) => s.settings` cũ — sẽ fix Task 5+.

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "refactor(store): narrow selectors, defaults cache, toast on save error"
```

---

## Task 5: ScrollSection dùng selector + memo + defaults từ store

**Files:**
- Modify: `src/components/settings/ScrollSection.tsx`

- [ ] **Step 1: Replace với selector pattern**

```tsx
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore, useScrollFields, useDefaults } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";
import { ScrollPresets } from "./ScrollPresets";
import { ResetButton } from "./ResetButton";

function ScrollSectionInner() {
  const { t } = useTranslation();
  const fields = useScrollFields();
  const defaults = useDefaults();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.scrolling")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <ScrollPresets />

        <SettingRow
          htmlFor="step-size"
          title={t("settings.step_size.title")}
          description={t("settings.step_size.desc")}
          trailing={`${fields.step_size_px}px`}
        >
          <Slider
            id="step-size"
            value={[fields.step_size_px]}
            min={10} max={500} step={5}
            className="w-48"
            onValueChange={([v]) => patch({ step_size_px: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ step_size_px: defaults.step_size_px })}
              disabled={fields.step_size_px === defaults.step_size_px}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="anim-time"
          title={t("settings.anim_time.title")}
          description={t("settings.anim_time.desc")}
          trailing={`${fields.animation_time_ms}ms`}
        >
          <Slider
            id="anim-time"
            value={[fields.animation_time_ms]}
            min={50} max={1500} step={10}
            className="w-48"
            onValueChange={([v]) => patch({ animation_time_ms: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ animation_time_ms: defaults.animation_time_ms })}
              disabled={fields.animation_time_ms === defaults.animation_time_ms}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="accel-delta"
          title={t("settings.accel_window.title")}
          description={t("settings.accel_window.desc")}
          trailing={`${fields.acceleration_delta_ms}ms`}
        >
          <Slider
            id="accel-delta"
            value={[fields.acceleration_delta_ms]}
            min={0} max={300} step={5}
            className="w-48"
            onValueChange={([v]) => patch({ acceleration_delta_ms: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ acceleration_delta_ms: defaults.acceleration_delta_ms })}
              disabled={fields.acceleration_delta_ms === defaults.acceleration_delta_ms}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="accel-max"
          title={t("settings.accel_max.title")}
          description={t("settings.accel_max.desc")}
          trailing={`${fields.acceleration_max}x`}
        >
          <Slider
            id="accel-max"
            value={[fields.acceleration_max]}
            min={1} max={20} step={1}
            className="w-48"
            onValueChange={([v]) => patch({ acceleration_max: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ acceleration_max: defaults.acceleration_max })}
              disabled={fields.acceleration_max === defaults.acceleration_max}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="tail-ratio"
          title={t("settings.tail_ratio.title")}
          description={t("settings.tail_ratio.desc")}
          trailing={`${fields.tail_to_head_ratio}`}
        >
          <Slider
            id="tail-ratio"
            value={[fields.tail_to_head_ratio]}
            min={1} max={20} step={1}
            className="w-48"
            onValueChange={([v]) => patch({ tail_to_head_ratio: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ tail_to_head_ratio: defaults.tail_to_head_ratio })}
              disabled={fields.tail_to_head_ratio === defaults.tail_to_head_ratio}
            />
          )}
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const ScrollSection = memo(ScrollSectionInner);
```

- [ ] **Step 2: TS check + commit**

Run: `npx tsc --noEmit`
```bash
git add src/components/settings/ScrollSection.tsx
git commit -m "perf(scroll): narrow selector + memo, defaults from store"
```

---

## Task 6: Refactor remaining Section components — same pattern

Pattern chung cho mỗi file:

1. Import: `import { memo } from "react";` + selector tương ứng (`useAppearanceFields`, etc.).
2. Đổi `const settings = useSettingsStore((s) => s.settings)` → `const fields = useXxxFields();`.
3. Đổi mọi `settings.field_name` → `fields.field_name`.
4. Guard: `if (!fields) return null;`.
5. Wrap `export const XxxSection = memo(XxxSectionInner);`.

- [ ] **Step 1: AppearanceSection** — `useAppearanceFields()`. Memo. TS check.

- [ ] **Step 2: DirectionSection** — `useDirectionFields()`. Memo. TS check.

- [ ] **Step 3: EdgeScrollSection** — `useEdgeScrollFields()`. Memo. TS check.

- [ ] **Step 4: KeyboardScrollSection** — `useKeyboardFields()`. Memo. TS check.

- [ ] **Step 5: TouchpadSection** (sub-project A đã rewrite) — đổi subscribe sang `useTouchpadFields()`, replace `settings.touchpad_*` → `fields.touchpad_*`. Memo wrap.

- [ ] **Step 6: BehaviorSection** — `useBehaviorFields()`. Memo. TS check.

- [ ] **Step 7: GameModeSection** — `useGameModeFields()`. Memo. TS check.

- [ ] **Step 8: EnableHeader** — `const enabled = useEnabled();`. Memo nếu chưa.

- [ ] **Step 9: Final TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Verify hardcoded DEFAULTS đã xoá**

Run: `grep -rn "DEFAULTS\s*=" src/components/settings/`
Expected: 0 match.

- [ ] **Step 11: Commit**

```bash
git add src/components/settings/
git commit -m "perf(sections): narrow selectors + memo across all setting sections"
```

---

## Task 7: Settings.tsx top-level subscribe cleanup

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Đổi sang narrow selector**

```tsx
import { useSettingsStore, useTheme } from "@/stores/settingsStore";

// inside SettingsPage:
const theme = useTheme();
const load = useSettingsStore((s) => s.load);
const setEnabledFromEvent = useSettingsStore((s) => s.setEnabledFromEvent);
const loading = useSettingsStore((s) => s.loading);
const error = useSettingsStore((s) => s.error);

useEffect(() => {
  const stop = watchSystemTheme(() => {
    if (theme === "System") applyTheme("System");
  });
  return stop;
}, [theme]);
```

Xoá `const settings = useSettingsStore((s) => s.settings);`.

- [ ] **Step 2: TS check + commit**

Run: `npx tsc --noEmit`
```bash
git add src/routes/Settings.tsx
git commit -m "perf(settings): replace full settings subscribe with narrow theme selector"
```

---

## Task 8: Performance verification (manual)

- [ ] **Step 1: Build dev với React DevTools Profiler**

```bash
npm run tauri dev
```

Mở DevTools → Profiler tab.

- [ ] **Step 2: Test re-render isolation**

1. Vào tab Scroll. Click "Record" trong Profiler.
2. Kéo slider `step_size` từ 100 → 300 (giữ chuột, kéo chậm 2 giây).
3. Stop recording.
4. ✅ pass nếu trong commit history:
   - `ScrollSection` re-render mỗi tick.
   - `AppearanceSection`, `TouchpadSection`, `EdgeScrollSection`, `KeyboardScrollSection`, `BehaviorSection` **0 lần re-render**.
   - Sidebar, EnableHeader **0 lần re-render**.

Failure mode: nếu các section khác re-render, kiểm tra selector có dùng `shallow` không, hoặc Section có còn `useSettingsStore((s) => s.settings)` không.

- [ ] **Step 3: Test debounce — single disk write per drag**

1. DevTools → Network tab.
2. Kéo slider liên tục 5 giây.
3. ✅ pass nếu chỉ thấy **1 IPC `save_settings`** sau khi user dừng kéo (350ms delay).

- [ ] **Step 4: Test toast khi save fail**

1. Tạm sửa `tauri.saveSettings`:
   ```typescript
   saveSettings: (settings: AppSettings) => Promise.reject("test failure"),
   ```
2. Đổi 1 setting bất kỳ → đợi 350ms.
3. ✅ pass nếu toast đỏ "Failed to save settings..." xuất hiện top-right, dismiss được, đúng ngôn ngữ.
4. **Khôi phục** `saveSettings`.

- [ ] **Step 5: Test ResetButton dùng defaults từ Rust**

1. Tab Scroll → kéo `step_size` lên 250.
2. Click ResetButton.
3. ✅ pass nếu slider snap về 120 (default từ Rust core).

Verification trong DevTools Console:
```js
window.__TAURI_INTERNALS__.invoke("get_default_settings").then(console.log)
```
Expected: `step_size_px: 120`.

- [ ] **Step 6: Test hot path UX — drag mượt**

1. Kéo slider liên tục 10s ở tab Scroll.
2. ✅ pass nếu drag mượt (60fps), không jerky.

- [ ] **Step 7: Production build check**

Run: `npm run tauri build`
Expected: build PASS.

---

## Task 9: Optional — Vitest setup

Skip nếu thời gian eo hẹp. Nếu làm:

- [ ] Cài: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `vitest.config.ts` với plugin react + alias `@`
- [ ] `src/stores/settingsStore.test.ts` test selector isolation
- [ ] Commit: `test(store): vitest setup + selector isolation tests`
