# Sub-project A — UI Consistency & i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ text hardcode tiếng Anh, hardcoded color, polling 1s không cần thiết. Nâng UX cho user dùng tiếng Việt/Trung và theme Light/System.

**Architecture:** TouchpadSection rewrite theo pattern `SettingRow` của các section khác, dùng `useTranslation()`. Backend emit event `input-source-changed` thay polling. TrayPanel chuyển sang CSS variables theme-aware + lucide-react icons + dùng `settingsStore` chung.

**Tech Stack:** React 18, TypeScript, Tauri 2 IPC + events, react-i18next, lucide-react, Tailwind CSS variables (đã định nghĩa trong `src/index.css`).

**Spec reference:** `docs/superpowers/specs/2026-05-17-smoothscroll-ux-perf-overhaul-design.md` § 3 (Sub-project A).

---

## File Structure

**Files modified:**
- `src/i18n/locales/en.json`, `vi.json`, `zh.json` — thêm key TouchpadSection
- `src/components/settings/TouchpadSection.tsx` — rewrite full
- `src/components/TrayPanel.tsx` — theme-aware + icon + store
- `src-tauri/src/state.rs` — atomic counter cho last input source (đã có `last_input_source: AtomicU8`)
- `src-tauri/src/hook_wiring.rs` — emit event khi source đổi
- `src-tauri/src/commands.rs` — thêm helper emit

**Files created:** none.

---

## Task 1: Thêm i18n keys cho TouchpadSection

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `src/i18n/locales/zh.json`

- [ ] **Step 1: Thêm key vào en.json**

Thêm vào object `section`: `"touchpad": "Precision touchpad"`

Thêm dưới `settings`:
```json
"touchpad": {
  "detected": "Detected",
  "source": {
    "Wheel": "Mouse wheel",
    "HighResWheel": "High-resolution wheel",
    "Touchpad": "Precision touchpad"
  },
  "enable": {
    "title": "Smooth touchpad scrolling",
    "desc": "Apply easing to high-resolution touchpad input"
  },
  "pixel_multiplier": {
    "title": "Pixel multiplier",
    "desc": "Scale raw pixel deltas from the touchpad"
  },
  "acceleration": {
    "title": "Acceleration factor",
    "desc": "Boost large flicks. 0 disables acceleration."
  }
}
```

- [ ] **Step 2: Thêm key vào vi.json**

Section: `"touchpad": "Touchpad chính xác"`

Settings:
```json
"touchpad": {
  "detected": "Đã phát hiện",
  "source": {
    "Wheel": "Chuột thường",
    "HighResWheel": "Chuột độ phân giải cao",
    "Touchpad": "Touchpad chính xác"
  },
  "enable": {
    "title": "Cuộn touchpad mượt",
    "desc": "Áp dụng easing cho input touchpad độ phân giải cao"
  },
  "pixel_multiplier": {
    "title": "Hệ số pixel",
    "desc": "Điều chỉnh delta pixel thô từ touchpad"
  },
  "acceleration": {
    "title": "Hệ số gia tốc",
    "desc": "Khuếch đại cú vuốt nhanh. 0 để tắt gia tốc."
  }
}
```

- [ ] **Step 3: Thêm key vào zh.json**

Section: `"touchpad": "精密触控板"`

Settings:
```json
"touchpad": {
  "detected": "已检测",
  "source": {
    "Wheel": "鼠标滚轮",
    "HighResWheel": "高分辨率滚轮",
    "Touchpad": "精密触控板"
  },
  "enable": {
    "title": "平滑触控板滚动",
    "desc": "对高分辨率触控板输入应用缓动"
  },
  "pixel_multiplier": {
    "title": "像素倍率",
    "desc": "缩放触控板的原始像素增量"
  },
  "acceleration": {
    "title": "加速系数",
    "desc": "增强快速滑动。0 表示禁用加速。"
  }
}
```

- [ ] **Step 4: Verify JSON valid**

Run: `node -e "['en','vi','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json','utf8')))"`
Expected: no error output.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/vi.json src/i18n/locales/zh.json
git commit -m "i18n: add TouchpadSection keys (en/vi/zh)"
```

---

## Task 2: Backend emit `input-source-changed` event

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Đọc `hook_wiring.rs` để hiểu chỗ source được set**

Read `src-tauri/src/hook_wiring.rs` — tìm dòng nào set `state.last_input_source.store(...)`.

- [ ] **Step 2: Thêm helper emit trong `commands.rs`**

Thêm vào `src-tauri/src/commands.rs` ngay sau `emit_settings_changed`:

```rust
/// Emit `input-source-changed` so the Settings UI reflects the live source
/// without polling. Call when InputClassifier transitions between sources.
pub(crate) fn emit_input_source_changed<R: tauri::Runtime>(
    app: &AppHandle<R>,
    label: &'static str,
) {
    let _ = app.emit("input-source-changed", label);
}
```

- [ ] **Step 3: Wire emit vào hook_wiring**

Tại điểm `state.last_input_source.store(code, Ordering::Relaxed)`:

1. Đọc giá trị cũ trước khi store: `let old = state.last_input_source.load(Ordering::Relaxed);`
2. Nếu `old != code`, emit:

```rust
let label: &'static str = match code {
    1 => "HighResWheel",
    2 => "Touchpad",
    _ => "Wheel",
};
crate::commands::emit_input_source_changed(&app_handle, label);
```

Nếu `hook_wiring` chưa có `app_handle`, propagate qua constructor hoặc giữ trong `AppState`. Nếu phức tạp, alternative: emit từ tick task định kỳ check `last_input_source` change (acceptable).

- [ ] **Step 4: `cargo check` xác minh build**

Run: `cargo check --workspace`
Expected: PASS, no warning từ thay đổi.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(tauri): emit input-source-changed event on classifier transition"
```

---

## Task 3: Rewrite TouchpadSection với i18n + event listener

**Files:**
- Modify: `src/components/settings/TouchpadSection.tsx`

- [ ] **Step 1: Replace toàn bộ file**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri, type InputSourceLabel } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingRow } from "./SettingRow";

const ICON: Record<InputSourceLabel, string> = {
  Wheel: "🖱️",
  HighResWheel: "🖱️ ⚡",
  Touchpad: "💻",
};

export function TouchpadSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [source, setSource] = useState<InputSourceLabel>("Wheel");

  useEffect(() => {
    let cancelled = false;
    void tauri.getInputSource().then((s) => {
      if (!cancelled) setSource(s);
    });
    const unlistenP = listen<InputSourceLabel>("input-source-changed", (e) => {
      setSource(e.payload);
    });
    return () => {
      cancelled = true;
      unlistenP.then((u) => u()).catch(() => {});
    };
  }, []);

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.touchpad")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
          <span className="text-muted-foreground">{t("settings.touchpad.detected")}:</span>
          <span aria-hidden>{ICON[source]}</span>
          <span className="font-medium">{t(`settings.touchpad.source.${source}`)}</span>
        </div>

        <SettingRow
          htmlFor="touchpad-enable"
          title={t("settings.touchpad.enable.title")}
          description={t("settings.touchpad.enable.desc")}
        >
          <Switch
            id="touchpad-enable"
            checked={settings.touchpad_smoothing_enabled}
            onCheckedChange={(v) => patch({ touchpad_smoothing_enabled: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="touchpad-mult"
          title={t("settings.touchpad.pixel_multiplier.title")}
          description={t("settings.touchpad.pixel_multiplier.desc")}
          trailing={`${settings.touchpad_pixel_multiplier.toFixed(2)}x`}
        >
          <Slider
            id="touchpad-mult"
            min={0.5}
            max={3}
            step={0.1}
            className="w-48"
            value={[settings.touchpad_pixel_multiplier]}
            onValueChange={([v]) => patch({ touchpad_pixel_multiplier: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </SettingRow>

        <SettingRow
          htmlFor="touchpad-accel"
          title={t("settings.touchpad.acceleration.title")}
          description={t("settings.touchpad.acceleration.desc")}
          trailing={`${settings.touchpad_acceleration_factor.toFixed(2)}x`}
        >
          <Slider
            id="touchpad-accel"
            min={0}
            max={3}
            step={0.1}
            className="w-48"
            value={[settings.touchpad_acceleration_factor]}
            onValueChange={([v]) => patch({ touchpad_acceleration_factor: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Run: `npm run tauri dev`
Mở app, vào tab Scroll, scroll xuống TouchpadSection.
Expected: title "Precision touchpad" hiển thị; khi đổi sang VI ở sidebar, title đổi sang "Touchpad chính xác". Cấu trúc 3 row đồng nhất với các section khác. Disabled state cho slider khi switch OFF vẫn hoạt động.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/TouchpadSection.tsx
git commit -m "ui: i18n TouchpadSection, replace polling with event listener"
```

---

## Task 4: TrayPanel theme-aware (CSS variables thay zinc-* hardcode)

**Files:**
- Modify: `src/components/TrayPanel.tsx`

- [ ] **Step 1: Đọc src/index.css để xác minh CSS variables có sẵn**

Read `src/index.css` — confirm `--background`, `--foreground`, `--border`, `--muted`, `--muted-foreground` đã định nghĩa cho cả light + dark.

- [ ] **Step 2: Replace tất cả hardcoded zinc-* + inline rgba**

a. Toggle button:
```tsx
className={`
  relative inline-flex h-5 w-9 items-center rounded-full
  transition-colors duration-200 focus:outline-none focus:ring-2
  focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
  ${checked ? 'bg-primary' : 'bg-muted'}
`}
```

b. SectionLabel: `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`

c. MenuItem variantClasses:
```tsx
const variantClasses = {
  default: 'text-foreground hover:bg-accent active:bg-accent/80',
  destructive: 'text-destructive hover:bg-accent active:bg-accent/80',
  muted: 'text-muted-foreground hover:bg-accent active:bg-accent/80',
};
```

Icon span: `text-muted-foreground` thay `text-zinc-400`.

d. Root container:
```tsx
<div className="tray-panel-root flex h-screen flex-col select-none overflow-hidden rounded-xl border bg-background/95 text-foreground shadow-2xl backdrop-blur">
```

Xoá `prevHtmlBg` / `prevBodyBg` logic trong useEffect.

e. Header:
```tsx
<div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
  ...
  <div className="ml-auto flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
    <span className={`text-[10px] font-medium transition-colors duration-300 ${enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
      {enabled ? t('tray.status_on') : t('tray.status_off')}
    </span>
  </div>
</div>
```

App title: `text-foreground`. Subtitle: `text-muted-foreground`.

f. Scroll container: `<div className="flex-1 overflow-y-auto scrollbar-thin">`

g. Footer:
```tsx
<div className="px-4 py-2 flex items-center justify-between border-t border-border/50">
  <span className="text-[10px] text-muted-foreground">SmoothScroll</span>
  <span className="text-[10px] text-muted-foreground">{appVersion}</span>
</div>
```

- [ ] **Step 3: Apply theme khi mount**

```tsx
import { applyTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/tauri";
// inside useEffect:
invoke<AppSettings>('get_settings').then((s) => {
  setStartMinimized(Boolean(s?.start_minimized));
  applyTheme((s?.theme ?? "System") as ThemeMode);
});
```

- [ ] **Step 4: TS check + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: `npm run tauri dev` → right-click tray → mở tray panel. Đổi theme Light/Dark/System ở main → mở tray panel lại → màu khớp theme.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "ui(tray): theme-aware colors via CSS variables"
```

---

## Task 5: Replace inline SVG icons trong TrayPanel bằng lucide-react

**Files:**
- Modify: `src/components/TrayPanel.tsx`

- [ ] **Step 1: Import lucide icons**

```tsx
import {
  MousePointer2,
  Monitor,
  Minimize2,
  Settings,
  LayoutGrid,
  FileText,
  Power,
} from "lucide-react";
```

- [ ] **Step 2: Xoá 7 inline SVG component**

Xoá `function IconScroll`, `IconWindows`, `IconMinimize`, `IconSettings`, `IconApps`, `IconLog`, `IconQuit`.

- [ ] **Step 3: Thay JSX usage**

- `<IconScroll />` → `<MousePointer2 className="h-4 w-4" />`
- `<IconWindows />` → `<Monitor className="h-4 w-4" />`
- `<IconMinimize />` → `<Minimize2 className="h-4 w-4" />`
- `<IconSettings />` → `<Settings className="h-4 w-4" />`
- `<IconApps />` → `<LayoutGrid className="h-4 w-4" />`
- `<IconLog />` → `<FileText className="h-4 w-4" />`
- `<IconQuit />` → `<Power className="h-4 w-4" />`

- [ ] **Step 4: TS check + visual smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: open tray panel → 7 menu icons stroke-style đồng nhất với sidebar (lucide).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "ui(tray): replace inline SVG icons with lucide-react"
```

---

## Task 6: TrayPanel dùng settingsStore

**Files:**
- Modify: `src/components/TrayPanel.tsx`

- [ ] **Step 1: Đổi state local sang store selectors**

```tsx
import { useSettingsStore } from "@/stores/settingsStore";
import { applyTheme } from "@/lib/theme";

export function TrayPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const patch = useSettingsStore((s) => s.patch);

  const [enabled, setEnabledState] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  const [appVersion, setAppVersion] = useState("0.1.0");
```

- [ ] **Step 2: useEffect mount logic**

```tsx
useEffect(() => {
  invoke<boolean>('get_enabled').then(setEnabledState);
  invoke<boolean>('get_autostart').then(setAutostartState);
  invoke<string>('app_version').then(setAppVersion);
  if (!settings) void load();

  const unlistenEnabled = listen<boolean>('enabled-changed', (event) => {
    setEnabledState(Boolean(event.payload));
  });

  return () => {
    unlistenEnabled.then((u) => u()).catch(() => {});
  };
}, []);

useEffect(() => {
  if (settings) applyTheme(settings.theme);
}, [settings?.theme]);
```

- [ ] **Step 3: Xoá `startMinimized` local state**

```tsx
const startMinimized = settings?.start_minimized ?? false;
```

- [ ] **Step 4: handleSetStartMinimized dùng patch**

```tsx
const handleSetStartMinimized = useCallback((v: boolean) => {
  patch({ start_minimized: v });
}, [patch]);
```

- [ ] **Step 5: TS check + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: mở main window → đổi `start_minimized` ở Behavior → mở tray panel → toggle hiển thị state mới ngay. Toggle ở tray panel → main window cập nhật.

- [ ] **Step 6: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "refactor(tray): use settingsStore for shared state"
```

---

## Task 7: Manual UX smoke test toàn sub-project A

- [ ] **Step 1: Build dev**

Run: `npm run tauri dev`

- [ ] **Step 2: Test 3 ngôn ngữ × TouchpadSection**

1. Settings → tab Scroll → TouchpadSection.
2. Đổi language en/vi/zh: tất cả label, description, "Detected: <source>" đúng.
3. ✅ pass nếu không còn English hardcode.

- [ ] **Step 3: Test event push (no polling)**

1. DevTools → Network tab.
2. Mở tab Scroll, đứng tại TouchpadSection 60s.
3. ✅ pass nếu **không** thấy IPC `get_input_source` lặp.
4. Đổi nguồn (wheel ↔ touchpad) → label update < 1s.

- [ ] **Step 4: Test theme TrayPanel**

1. Theme = Light → tray panel mở → background sáng.
2. Theme = Dark → background tối.
3. Theme = System → đổi OS theme → tray panel theo system khi mở lại.
4. ✅ pass cả 3 mode.

- [ ] **Step 5: Test sync state main ↔ tray**

1. Mở 2 cửa sổ cùng lúc.
2. Toggle tray → main update ngay.
3. Toggle main → tray update ngay.
4. ✅ pass nếu 2 hướng đồng bộ.

- [ ] **Step 6: Build production check**

Run: `npm run tauri build`
Expected: build pass.
