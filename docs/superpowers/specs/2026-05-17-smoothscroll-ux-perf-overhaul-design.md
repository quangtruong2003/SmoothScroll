# SmoothScroll UX & Performance Overhaul — Design Spec

**Date:** 2026-05-17
**Status:** Draft (awaiting user approval)
**Author:** Brainstorm session
**Scope owner:** quangtruong2003

---

## 1. Mục tiêu tổng thể

Tối ưu hoá frontend (React + TypeScript) của SmoothScroll trên 4 trục độc lập:

1. Loại bỏ text hardcode, hardcoded color, polling không cần thiết.
2. Fix root cause của re-render dư thừa và disk-thrash khi user kéo slider.
3. Loại race condition trong boot sequence của `App.tsx`.
4. Thống nhất layout giữa các tab Settings, polish UX nhỏ.

**Không đổi**: scroll engine (Rust core), platform hooks (Windows/macOS), schema settings, hệ profile/excluded-apps logic. Mọi thay đổi giữ backwards-compatible với `settings.json` hiện tại.

**Outcome đo được**:
- React DevTools Profiler: kéo slider không re-render section không liên quan.
- Disk: chỉ 1 lần ghi `settings.json` sau khi user dừng kéo slider 250ms.
- 100% string trong UI có thể dịch được (en/vi/zh) — không còn hardcoded English.
- Cold-start: không thấy null/blank screen flash > 100ms.
- TrayPanel respect theme light/dark.

---

## 2. Phạm vi (4 sub-projects)

Spec này chứa 4 sub-project độc lập. Mỗi sub-project sẽ được implement bằng 1 plan riêng. Không cần làm tuần tự — có thể parallel hoặc chọn 1-2 sub-project trước.

| ID | Sub-project | Estimate | Risk |
|----|-------------|----------|------|
| A | UI consistency & i18n | 3-4h | Thấp |
| B | State & performance | 4-6h | Trung (đụng store) |
| C | App.tsx orchestration | 2-3h | Thấp |
| D | Settings layout & UX polish | 3-4h | Thấp |

---

## 3. Sub-project A — UI consistency & i18n

### 3.1 Vấn đề hiện tại

- `src/components/settings/TouchpadSection.tsx`: tất cả text hardcoded tiếng Anh ("Precision touchpad", "Enable touchpad smoothing", "Pixel multiplier", "Acceleration factor", "Detected"). Không qua `useTranslation()`. Khi user dùng tiếng Việt/Trung, section này vẫn hiện English.
- `TouchpadSection.tsx:20-25`: `setInterval(() => tauri.getInputSource().then(setSource), 1000)` chạy **mỗi giây** suốt thời gian Settings page mở. Lãng phí IPC, mỗi call wake up Rust thread.
- `src/components/TrayPanel.tsx`: hardcoded zinc-* colors inline (`bg-zinc-900`, `text-zinc-50`, `border-zinc-700`...) và `rgba(24, 24, 27, 0.96)`. Tray panel **luôn** dark, không respect theme system/light.
- `TrayPanel.tsx`: 7 SVG icons custom inline (IconScroll, IconWindows, IconMinimize, IconSettings, IconApps, IconLog, IconQuit) trong khi phần còn lại dùng `lucide-react` (Activity, AppWindow, Info, ...). Style icon không đồng nhất.
- `TrayPanel.tsx:183`: gọi `invoke<AppSettings>('get_settings')` riêng dù `settingsStore` đã có. Tray panel duplicate state, dễ drift với main window.

### 3.2 Yêu cầu

**A1. i18n hoá TouchpadSection**

Thêm các key sau vào `src/i18n/locales/{en,vi,zh}.json`:

```
section.touchpad
settings.touchpad.detected
settings.touchpad.source.Wheel
settings.touchpad.source.HighResWheel
settings.touchpad.source.Touchpad
settings.touchpad.enable.title
settings.touchpad.enable.desc
settings.touchpad.pixel_multiplier.title
settings.touchpad.pixel_multiplier.desc
settings.touchpad.acceleration.title
settings.touchpad.acceleration.desc
```

`TouchpadSection` rewrite dùng `useTranslation()` + `SettingRow` (giống các section khác — hiện đang dùng layout custom).

**A2. Thay polling bằng event push**

- Backend: trong `src-tauri/src/hook_wiring.rs`, khi `InputClassifier` xác định nguồn input đổi (Wheel ↔ HighResWheel ↔ Touchpad), emit event `input-source-changed` payload là `InputSourceLabel`.
- Frontend: `TouchpadSection` thay `setInterval` bằng `listen<InputSourceLabel>('input-source-changed', ...)`. Initial value vẫn lấy 1 lần qua `tauri.getInputSource()` lúc mount.
- Giữ `tauri.getInputSource()` IPC để initial fetch và fallback.

**A3. TrayPanel theme-aware**

- Thay tất cả màu zinc-* hardcoded bằng CSS variables hiện có (`bg-background`, `text-foreground`, `border-border`, `bg-muted`...) — đã định nghĩa trong `src/index.css`.
- Background frosted: dùng `bg-background/95 backdrop-blur` (có sẵn trong Tailwind config).
- Borderline: `border-border/50` thay `rgba(63, 63, 70, 0.5)`.
- Status dot: dùng `bg-green-500` / `bg-muted-foreground` theo `enabled`, không inline hex.
- Apply theme khi tray panel mount: gọi `applyTheme(currentSettings.theme)` để document class đúng.

**A4. Replace inline SVG icons bằng lucide-react**

Mapping (chọn 1 icon cho mỗi):
- `IconScroll` → `MousePointer2` (lucide không có MouseScroll; MousePointer2 phù hợp ngữ cảnh chuột)
- `IconWindows` → `Monitor`
- `IconMinimize` → `Minimize2`
- `IconSettings` → `Settings`
- `IconApps` → `LayoutGrid`
- `IconLog` → `FileText`
- `IconQuit` → `Power`

Bundle size impact: lucide-react tree-shake; mỗi icon ~1-2 KB. Tổng tăng < 10 KB gzipped, chấp nhận được vì đã import lucide ở Sidebar.

**A5. TrayPanel dùng settingsStore**

- Thay `invoke<AppSettings>('get_settings')` + `listen('settings-changed')` riêng bằng `useSettingsStore()`.
- Action `handleSetEnabled`, `handleSetAutostart`, `handleSetStartMinimized` gọi `patch()` của store thay vì `invoke('save_settings', ...)` raw.
- TrayPanel mount → `load()` store nếu chưa load.

### 3.3 Out of scope

- Không redesign TrayPanel.
- Không đổi structure menu (sections vẫn là Quick Access / Actions / About).
- Không thêm tính năng mới.

### 3.4 Success criteria

- [ ] Mở app, đổi sang tiếng Việt/Trung → TouchpadSection hiển thị đúng ngôn ngữ.
- [ ] Mở Settings, vào tab Scroll, để mở 60s → DevTools Network tab không thấy IPC `get_input_source` lặp.
- [ ] Cắm chuột pad → trong < 1s, TouchpadSection update label "Detected: Touchpad".
- [ ] Đổi theme từ tray right-click → mở tray panel → màu sắc khớp theme (light tray panel khi theme Light).
- [ ] Toggle "Enable smooth scrolling" trong tray panel → main window Settings cập nhật ngay (chung store).
- [ ] `npm run tauri build` không có warning về missing translation key.

---

## 4. Sub-project B — State & performance

### 4.1 Vấn đề hiện tại

- `src/stores/settingsStore.ts:53-62`: `patch()` merge **toàn bộ settings** vào state mỗi lần thay đổi 1 field. Mọi component subscribe `(s) => s.settings` đều re-render.
- `src/routes/Settings.tsx:25` và 12+ section components đều `useSettingsStore((s) => s.settings)` rồi destructure → re-render khi field bất kỳ thay đổi.
- Debounce hiện tại 250ms áp dụng cho **toàn bộ payload** (`debouncedPersist(next)`). Khi kéo slider liên tục, mỗi tick `onValueChange` gọi `patch` → state replace → re-render section. Debounce chỉ giảm IO, không giảm React work.
- `src/components/settings/ScrollSection.tsx:9-15`: hardcoded `DEFAULTS` trong frontend. Source of truth là Rust `AppSettings::default()` trong `crates/core`, dễ drift.
- `tauri.saveSettings` failure → chỉ `console.error("save_settings failed", e)`. User không biết settings không persist. Có sẵn `src/components/ui/toast.tsx` nhưng không wire.
- Section components không memo. ProfilesSection, ExcludedAppsSection đặc biệt nặng vì có dialog + list.

### 4.2 Yêu cầu

**B1. Selectors hẹp**

Thêm vào `src/stores/settingsStore.ts`:

```typescript
import { shallow } from "zustand/shallow";

export const useEnabled = () => useSettingsStore((s) => s.settings?.enabled ?? false);
export const useTheme = () => useSettingsStore((s) => s.settings?.theme ?? "System");
export const useScrollFields = () => useSettingsStore((s) => {
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
```

Tương tự cho `useTouchpadFields`, `useKeyboardFields`, `useEdgeScrollFields`, `useGameModeFields`, `useBehaviorFields`, `useAppearanceFields`. Dùng `shallow` từ `zustand/shallow`.

Refactor mỗi Section component dùng selector tương ứng. Không destructure `settings` toàn bộ.

**B2. Centralize DEFAULTS từ Rust**

- Backend: thêm IPC `get_default_settings() -> AppSettings` trong `src-tauri/src/commands.rs`. Trả về `AppSettings::default()` từ `crates/core`.
- Frontend: thêm `tauri.getDefaultSettings()` vào `src/lib/tauri.ts`. Cache trong `settingsStore.defaults: AppSettings | null`. Load khi `load()` chạy.
- Mỗi Section component dùng `useDefaults()` selector để lấy default value cho `ResetButton`. Xoá hardcoded `DEFAULTS` trong từng file.

**B3. Debounce trailing — single snapshot persist**

Quyết định: giữ payload-level debounce (không per-field), tăng delay từ 250ms → 350ms để cover 1 thao tác kéo slider điển hình (~200-300ms). Lý do: per-field debounce phức tạp hơn (cần merge các key timer thành 1 disk write cuối cùng), value gain nhỏ vì save_settings hiện tại đã debounced — root cause re-render nằm ở B1 (selectors hẹp), không phải debounce.

Implementation:
- `SAVE_DEBOUNCE_MS = 350` trong `src/stores/settingsStore.ts`.
- `patch()` giữ logic merge memory ngay + `debouncedPersist(next)` như hiện tại.
- Thêm comment giải thích trade-off.

**B4. Toast feedback khi saveSettings fail**

- Tạo `src/lib/toast.ts` wrapper trên Radix Toast hiện có hoặc dùng store pattern.
- Trong `settingsStore.debouncedPersist` catch block, gọi `toast.error(t("error.save_failed"))`.
- Mount `<Toaster />` provider trong `src/main.tsx`.
- Thêm i18n key `error.save_failed` vào 3 locale.

**B5. Memo Section components**

Wrap mỗi Section component bằng `React.memo()`. Vì props không thay đổi (component đọc store qua selector), memo + selector hẹp = re-render chỉ khi field liên quan đổi.

### 4.3 Out of scope

- Không refactor Zustand → Redux/Jotai/etc.
- Không đổi shape `AppSettings` (type).
- Không touch `app_profiles` / `excluded_apps` mutation logic (đã có per-action sync).

### 4.4 Success criteria

- [ ] React DevTools Profiler: mở tab Scroll, kéo slider step_size từ 50 → 500 — chỉ `ScrollSection` re-render. Không thấy `TouchpadSection`, `AppearanceSection` re-render.
- [ ] Mở DevTools Network → kéo slider 5s liên tục → đếm số IPC `save_settings`: chỉ 1 (sau khi dừng).
- [ ] Test giả lập `saveSettings` throw → toast error xuất hiện top-right, dismiss được, có translation đúng.
- [ ] DEFAULTS không còn xuất hiện trong frontend code (grep: 0 match).
- [ ] Reset button trong mọi section vẫn hoạt động đúng (lấy default từ Rust).

---

## 5. Sub-project C — App.tsx orchestration

### 5.1 Vấn đề hiện tại

`src/App.tsx` có 3 `useEffect` độc lập + 4 piece of state:
- `granted: boolean | null` (accessibility)
- `windowLabel: string | null`
- `updateGate: UpdateGateState`
- `trusted: boolean`

Sequence không rõ:
- Update check fire ngay khi `windowLabel === "main"` (race với accessibility check).
- `trusted` fetch luôn fire, dù `windowLabel === "tray-panel"` không cần.
- Render path có 4 nhánh, dễ thấy null flash giữa các transition.
- ForcedUpdateModal có thể hiện trước khi `trusted` resolve → `canSkip={false}` ban đầu rồi update sau (nháy nút "Skip").

### 5.2 Yêu cầu

**C1. Boot state machine**

Tạo `src/lib/bootMachine.ts`:

```typescript
export type BootState =
  | { kind: "init" }
  | { kind: "tray-panel" }
  | { kind: "checking-accessibility" }
  | { kind: "needs-accessibility" }
  | { kind: "checking-update"; trusted: boolean }
  | { kind: "update-required"; update: Update; currentVersion: string; trusted: boolean }
  | { kind: "ready" };

export type BootEvent =
  | { type: "WINDOW_DETECTED"; label: string }
  | { type: "ACCESSIBILITY_RESULT"; granted: boolean }
  | { type: "TRUSTED_RESULT"; trusted: boolean }
  | { type: "UPDATE_AVAILABLE"; update: Update; currentVersion: string }
  | { type: "UPDATE_NONE" }
  | { type: "ACCESSIBILITY_GRANTED" }
  | { type: "UPDATE_SKIPPED" };

export function bootReducer(state: BootState, event: BootEvent): BootState
```

Sequence:
```
init → WINDOW_DETECTED
  ├─ label === "tray-panel" → tray-panel (terminal)
  └─ else → checking-accessibility

checking-accessibility → ACCESSIBILITY_RESULT
  ├─ granted=false → needs-accessibility (waits for ACCESSIBILITY_GRANTED)
  └─ granted=true → checking-update (parallel: trusted lookup)

checking-update → UPDATE_AVAILABLE | UPDATE_NONE
  ├─ available → update-required (after trusted resolves)
  └─ none → ready
```

Trusted resolve trước khi vào `update-required` để `canSkip` cuối cùng đã đúng — không nháy.

**C2. Refactor `App.tsx`**

```typescript
const [state, dispatch] = useReducer(bootReducer, { kind: "init" });

useEffect(() => {
  dispatch({ type: "WINDOW_DETECTED", label: getCurrentWindow().label });
}, []);

useEffect(() => {
  if (state.kind !== "checking-accessibility") return;
  tauri.accessibilityStatus()
    .then((g) => dispatch({ type: "ACCESSIBILITY_RESULT", granted: g }))
    .catch(() => dispatch({ type: "ACCESSIBILITY_RESULT", granted: true }));
}, [state.kind]);

// ... similar for checking-update
```

Render:
```typescript
switch (state.kind) {
  case "init":
  case "checking-accessibility":
  case "checking-update": return null; // or a tiny spinner after 200ms
  case "tray-panel": return <TrayPanel />;
  case "needs-accessibility":
    return <PermissionGate onGranted={() => dispatch({ type: "ACCESSIBILITY_GRANTED" })} />;
  case "update-required":
    return <ForcedUpdateModal ... canSkip={state.trusted} ... />;
  case "ready": return <SettingsPage />;
}
```

**C3. Optional: skeleton thay vì null**

Sau 200ms ở các state "checking-*", show splash/skeleton (logo + spinner). Dưới 200ms vẫn null (tránh flash). Implement: `useDelayedFlag(200)`.

### 5.3 Out of scope

- Không refactor PermissionGate.
- Không đổi Updater logic (`src/lib/updater.ts`).
- Không thay XState — useReducer là đủ.

### 5.4 Success criteria

- [ ] Cold start app 10 lần → không lần nào thấy null screen > 200ms (splash hiện sau).
- [ ] ForcedUpdateModal khi mount, nút "Skip" hiển thị final state ngay (không nháy show/hide).
- [ ] Tray-panel window không gọi `accessibilityStatus` / `checkForUpdate` / `isTrustedDevice`.
- [ ] Test: mock `accessibilityStatus()` reject → app vẫn render Settings (giữ behaviour cũ).

---

## 6. Sub-project D — Settings layout & UX polish

### 6.1 Vấn đề hiện tại

- `src/routes/Settings.tsx:88-115`: pattern `<div className="overflow-y-auto pr-1"><div className="space-y-3">...</div></div>` lặp 3 lần (scroll, apps, preferences). General và about thì khác. DRY violation.
- Chỉ tab "general" có header (`<EnableHeader />`). Các tab khác mở thẳng vào content, user mất context "đang ở đâu".
- `src/components/Sidebar.tsx`: tab active dùng `bg-primary text-primary-foreground` — solid pill, không có vertical accent. Trên macOS native settings convention là left accent border.
- Chuyển tab snap instant, không có transition nào.
- ResetButton chỉ có ở `ScrollSection` (tất cả 5 row). `AppearanceSection`, `KeyboardScrollSection`, `TouchpadSection`, `EdgeScrollSection`, `BehaviorSection` không có ResetButton trên slider/switch.

### 6.2 Yêu cầu

**D1. `<TabContent>` wrapper**

Tạo `src/components/settings/TabContent.tsx`:

```typescript
interface TabContentProps {
  title?: string;
  description?: string;
  scrollable?: boolean;
  children: React.ReactNode;
}

export function TabContent({ title, description, scrollable = true, children }: TabContentProps) {
  return (
    <div className="flex flex-col h-full gap-3">
      {(title || description) && (
        <div className="space-y-0.5 shrink-0">
          {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={scrollable ? "flex-1 overflow-y-auto pr-1" : "flex-1"}>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
```

`Settings.tsx` rewrite mỗi tab dùng `<TabContent title=... description=...>`.

**D2. Per-tab header**

Thêm i18n key cho mỗi tab:

```
tabs.general.title       "General"
tabs.general.description "Quick toggles and live test."
tabs.scroll.title        "Scroll"
tabs.scroll.description  "Tune step size, easing, and direction."
tabs.apps.title          "Apps"
tabs.apps.description    "Per-app profiles and exclusions."
tabs.preferences.title   "Preferences"
tabs.preferences.description "Behavior, hotkeys, game mode."
tabs.about.title         "About"
tabs.about.description   "Version, updates, logs."
```

(Dịch vi/zh tương ứng.)

**D3. Tab indicator**

Trong `Sidebar.tsx`, thay layout button bằng:

```jsx
<button ... className="relative ...">
  <span className={cn(
    "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-all",
    isActive ? "bg-primary" : "bg-transparent"
  )} />
  {tab.icon}
  <span>{t(tab.labelKey)}</span>
</button>
```

Active state: `bg-accent text-foreground` + accent bar bên trái. Inactive: `text-muted-foreground hover:bg-accent`.

**D4. Tab transition**

Trong `<main>` của Settings, wrap content bằng:

```jsx
<div key={tab} className="animate-in fade-in duration-150">
  {tabContent}
</div>
```

Tailwind `tw-animate-css` đã có (check `package.json`); fallback: tự CSS keyframe.

**D5. ResetButton consistency**

Audit tất cả Section component có slider hoặc value số. Thêm `<ResetButton>` trailing cho mọi `SettingRow` có giá trị có thể reset:
- `KeyboardScrollSection`: `keyboard_pgdn_step_notches`, `keyboard_arrow_step_notches`
- `TouchpadSection`: `touchpad_pixel_multiplier`, `touchpad_acceleration_factor`
- `EdgeScrollSection`: `edge_scroll_zone_px`, `edge_scroll_max_notches_per_sec`
- `AppearanceSection`: easing-related row (nếu áp dụng)

Default value lấy từ `useDefaults()` (selector từ Sub-project B). Nếu làm Sub-project D trước B → tạm dùng hardcoded DEFAULTS, khi làm B sẽ migrate.

### 6.3 Out of scope

- Không redesign tổng thể (palette, typography).
- Không thêm tab mới.
- Không touch macOS PermissionGate UI.

### 6.4 Success criteria

- [ ] 5 tab cùng pattern: header (title + description) + scrollable content.
- [ ] Sidebar tab active: accent bar bên trái + bg accent nhẹ. Visual khác biệt rõ với inactive.
- [ ] Chuyển tab có fade 150ms, không jarring.
- [ ] Mọi slider trong Settings có ResetButton (grep: 0 slider thiếu).
- [ ] Tab title/description đúng theo 3 ngôn ngữ.

---

## 7. Cross-cutting concerns

### 7.1 Test strategy

Hiện không thấy test setup cho frontend (chỉ `cargo test --workspace`). Đề xuất:

- **Sub-project A**: smoke test thủ công (3 ngôn ngữ × 2 theme × tray panel + main window).
- **Sub-project B**: manual test với React DevTools Profiler. Optional: viết Vitest setup nếu chưa có, test selector hành vi.
- **Sub-project C**: viết unit test cho `bootReducer` (pure function, dễ test) — đây là lý do tách reducer ra file riêng.
- **Sub-project D**: visual regression nếu có thời gian; nếu không, manual QA checklist.

Mỗi plan sẽ ghi rõ test approach.

### 7.2 Dependency

- Sub-project B (centralize DEFAULTS) là **dependency mềm** cho Sub-project D (ResetButton consistency). Nếu làm D trước B, dùng hardcoded DEFAULTS tạm và TODO migrate.
- Các sub-project còn lại độc lập.

### 7.3 Backwards compatibility

- `settings.json` schema không đổi → user upgrade không mất config.
- IPC mới (`get_default_settings`, event `input-source-changed`) là additive — không break IPC cũ.
- `tauri.getInputSource()` giữ lại cho fallback.

### 7.4 Rollout

Làm tuần tự A → C → B → D, hoặc parallel A+C (independent). Mỗi sub-project 1 PR, có thể ship riêng.

---

## 8. Files affected (preview)

| Sub-project | Files |
|-------------|-------|
| A | `src/components/settings/TouchpadSection.tsx`, `src/components/TrayPanel.tsx`, `src/i18n/locales/{en,vi,zh}.json`, `src-tauri/src/commands.rs`, `src-tauri/src/hook_wiring.rs` |
| B | `src/stores/settingsStore.ts`, `src/lib/debounce.ts`, `src/lib/tauri.ts`, `src/lib/toast.ts` (new), `src/main.tsx`, `src-tauri/src/commands.rs`, all `src/components/settings/*Section.tsx` |
| C | `src/App.tsx`, `src/lib/bootMachine.ts` (new), `src/lib/bootMachine.test.ts` (new) |
| D | `src/routes/Settings.tsx`, `src/components/Sidebar.tsx`, `src/components/settings/TabContent.tsx` (new), `src/i18n/locales/{en,vi,zh}.json`, all `src/components/settings/*Section.tsx` (ResetButton audit) |

---

## 9. Open questions

1. **Toast library**: Radix Toast (`src/components/ui/toast.tsx` đã có) — quyết định dùng cái này, không add `sonner`.
2. **Splash screen** (Sub-project C): null + delay 200ms flag — quyết định dùng pattern này, không thêm splash component.
3. **Debounce strategy** (Sub-project B): payload-level debounce 350ms — quyết định đã ghi trong B3.

3 quyết định trên đã chốt; user override khi review nếu muốn.

---

## 10. Approval

**Trạng thái**: chờ user duyệt.

Sau khi duyệt:
1. Spec commit vào `docs/superpowers/specs/`.
2. Viết 4 plan: `2026-05-17-subproject-a-ui-i18n.md`, `-b-state-perf.md`, `-c-app-orchestration.md`, `-d-settings-layout.md`.
3. User chọn execution mode (subagent-driven / inline) cho từng plan.
