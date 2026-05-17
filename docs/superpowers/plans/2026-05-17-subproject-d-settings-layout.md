# Sub-project D — Settings Layout & UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thống nhất layout 5 tab Settings, thêm header context cho mỗi tab, accent indicator sidebar, fade transition giữa các tab, và ResetButton consistency cho mọi slider. UX outcome: user luôn biết "đang ở đâu", chuyển tab mượt, mọi giá trị tweak được đều có đường lùi về default.

**Architecture:** Tách `<TabContent>` wrapper để DRY pattern `header + scrollable area`. Sidebar tab dùng accent left bar + soft hover/active. Wrap `<main>` content theo key tab → fade in transition. Audit mọi Section có slider → bổ sung ResetButton dùng `useDefaults()` selector từ Sub-project B (hoặc tạm hardcode nếu B chưa làm).

**Tech Stack:** React 18, Tailwind CSS với `tw-animate-css` plugin, `lucide-react`, react-i18next.

**Spec reference:** `docs/superpowers/specs/2026-05-17-smoothscroll-ux-perf-overhaul-design.md` § 6 (Sub-project D).

**Dependency note:** Task 7 (ResetButton consistency) lý tưởng dùng `useDefaults()` từ Sub-project B Task 1-4. Nếu B chưa làm, fallback hardcoded DEFAULTS với TODO comment để migrate sau.

---

## File Structure

**Files modified:**
- `src/routes/Settings.tsx` — render qua `<TabContent>` + fade key
- `src/components/Sidebar.tsx` — accent indicator + label keys
- `src/components/settings/EnableHeader.tsx` — bỏ duplicate header
- `src/components/settings/{KeyboardScroll,Touchpad,EdgeScroll,Behavior,Appearance}Section.tsx` — ResetButton audit
- `src/i18n/locales/{en,vi,zh}.json` — tab title/description keys

**Files created:**
- `src/components/settings/TabContent.tsx`

---

## Task 1: i18n keys cho tab title + description

**Files:**
- Modify: `src/i18n/locales/en.json`, `vi.json`, `zh.json`

- [ ] **Step 1: Đổi `tabs.{key}` từ string sang object**

en.json:
```json
"tabs": {
  "general": {
    "label": "General",
    "title": "General",
    "description": "Quick toggles and live test."
  },
  "scroll": {
    "label": "Scroll",
    "title": "Scroll",
    "description": "Tune step size, easing, direction, and input sources."
  },
  "apps": {
    "label": "Apps",
    "title": "Per-app",
    "description": "Profiles and exclusions tailored to specific applications."
  },
  "preferences": {
    "label": "Preferences",
    "title": "Preferences",
    "description": "Behavior, hotkeys, and game mode."
  },
  "about": {
    "label": "About",
    "title": "About",
    "description": "Version, updates, and logs."
  }
}
```

vi.json:
```json
"tabs": {
  "general": { "label": "Chung", "title": "Chung", "description": "Bật/tắt nhanh và khu vực thử nghiệm." },
  "scroll": { "label": "Cuộn", "title": "Cuộn", "description": "Tinh chỉnh bước cuộn, easing, hướng và nguồn input." },
  "apps": { "label": "Ứng dụng", "title": "Theo ứng dụng", "description": "Profile và loại trừ riêng cho từng ứng dụng." },
  "preferences": { "label": "Tuỳ chọn", "title": "Tuỳ chọn", "description": "Hành vi, phím tắt và chế độ game." },
  "about": { "label": "Thông tin", "title": "Thông tin", "description": "Phiên bản, cập nhật và log." }
}
```

zh.json:
```json
"tabs": {
  "general": { "label": "通用", "title": "通用", "description": "快速切换与实时测试。" },
  "scroll": { "label": "滚动", "title": "滚动", "description": "调整步长、缓动、方向和输入源。" },
  "apps": { "label": "应用", "title": "按应用", "description": "针对特定应用的配置和排除项。" },
  "preferences": { "label": "偏好", "title": "偏好", "description": "行为、热键和游戏模式。" },
  "about": { "label": "关于", "title": "关于", "description": "版本、更新和日志。" }
}
```

- [ ] **Step 2: Verify JSON valid**

Run: `node -e "['en','vi','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json','utf8')))"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/vi.json src/i18n/locales/zh.json
git commit -m "i18n: tab labels become objects with title + description"
```

---

## Task 2: Sidebar dùng `tabs.<key>.label`

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Đổi `labelKey` reference**

Trong `TABS` array, đổi mỗi entry:
```typescript
{ key: "general", labelKey: "tabs.general.label", icon: ... },
{ key: "scroll", labelKey: "tabs.scroll.label", icon: ... },
{ key: "apps", labelKey: "tabs.apps.label", icon: ... },
{ key: "preferences", labelKey: "tabs.preferences.label", icon: ... },
{ key: "about", labelKey: "tabs.about.label", icon: ... },
```

- [ ] **Step 2: TS check + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: `npm run tauri dev` → sidebar label đúng cho 3 ngôn ngữ.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "ui(sidebar): use nested tabs.<key>.label keys"
```

---

## Task 3: TabContent wrapper

**Files:**
- Create: `src/components/settings/TabContent.tsx`

- [ ] **Step 1: Tạo file**

```tsx
import { ReactNode } from "react";

interface TabContentProps {
  title?: string;
  description?: string;
  /** Whether the inner content should scroll independently (default true). */
  scrollable?: boolean;
  children: ReactNode;
}

/**
 * Standard layout for a Settings tab: optional header (title + description)
 * + scrollable content area. Centralizes the boilerplate
 * `<div className="overflow-y-auto pr-1">` pattern used previously per tab.
 */
export function TabContent({
  title,
  description,
  scrollable = true,
  children,
}: TabContentProps) {
  return (
    <div className="flex flex-col h-full gap-3">
      {(title || description) && (
        <div className="space-y-0.5 shrink-0">
          {title && (
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className={scrollable ? "flex-1 overflow-y-auto pr-1" : "flex-1"}>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/TabContent.tsx
git commit -m "feat(settings): TabContent wrapper for consistent tab layout"
```

---

## Task 4: Settings.tsx render qua TabContent + fade transition

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Replace render trong `<main>`**

```tsx
import { TabContent } from "@/components/settings/TabContent";

// inside SettingsPage return:
<div className="flex h-screen overflow-hidden">
  <Sidebar active={tab} onChange={setTab} t={t} />
  <main className="flex-1 overflow-hidden px-6 py-5">
    <div
      key={tab}
      className="mx-auto h-full max-w-2xl animate-in fade-in duration-150"
    >
      {tab === "general" && (
        <TabContent
          title={t("tabs.general.title")}
          description={t("tabs.general.description")}
          scrollable={false}
        >
          <EnableHeader />
          <TestSandboxSection />
        </TabContent>
      )}

      {tab === "scroll" && (
        <TabContent
          title={t("tabs.scroll.title")}
          description={t("tabs.scroll.description")}
        >
          <ScrollSection />
          <AppearanceSection />
          <DirectionSection />
          <EdgeScrollSection />
          <KeyboardScrollSection />
          <TouchpadSection />
        </TabContent>
      )}

      {tab === "apps" && (
        <TabContent
          title={t("tabs.apps.title")}
          description={t("tabs.apps.description")}
        >
          <ProfilesSection />
          <ExcludedAppsSection />
        </TabContent>
      )}

      {tab === "preferences" && (
        <TabContent
          title={t("tabs.preferences.title")}
          description={t("tabs.preferences.description")}
        >
          <BehaviorSection />
          <GameModeSection />
        </TabContent>
      )}

      {tab === "about" && (
        <TabContent
          title={t("tabs.about.title")}
          description={t("tabs.about.description")}
          scrollable={false}
        >
          <AboutSection />
        </TabContent>
      )}
    </div>
  </main>
</div>
```

**Note:** `key={tab}` ép React unmount/mount component khi tab đổi → trigger lại animation `animate-in fade-in`.

- [ ] **Step 2: Verify Tailwind animate plugin**

Read `tailwind.config.js` (hoặc `.ts`) — confirm có `tw-animate-css` plugin hoặc `animate-in`/`fade-in` utility (shadcn project thường có sẵn).

Nếu không có, fallback: thêm vào `src/index.css`:
```css
@keyframes ss-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-tab-in {
  animation: ss-fade-in 150ms ease-out;
}
```

Và đổi `animate-in fade-in duration-150` → `animate-tab-in`.

- [ ] **Step 3: TS check + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: chuyển 5 tab — mỗi lần fade in 150ms, không jarring. Header title + description hiển thị đúng ngôn ngữ.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Settings.tsx src/index.css
git commit -m "ui(settings): TabContent wrapper + 150ms fade between tabs"
```

---

## Task 5: EnableHeader de-duplication

**Files:**
- Modify: `src/components/settings/EnableHeader.tsx`

- [ ] **Step 1: Đọc file hiện tại**

Read `src/components/settings/EnableHeader.tsx` để xác định content.

- [ ] **Step 2: Quyết định scope**

Phân loại:
- Case A: EnableHeader hiện banner "SmoothScroll" + tagline + toggle → giữ nguyên (banner cùng tab title không xung đột vì khác content).
- Case B: EnableHeader chỉ là toggle row → giữ nguyên.
- Case C: EnableHeader có heading "General" lặp với TabContent title → bỏ heading, giữ toggle/tagline.

Apply quyết định tương ứng.

- [ ] **Step 3: TS check + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: tab General — title "General" từ TabContent, dưới là EnableHeader. Không thấy "General" lặp 2 lần.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/EnableHeader.tsx
git commit -m "ui(settings): de-duplicate EnableHeader vs TabContent title"
```

---

## Task 6: Sidebar tab accent indicator

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Replace tab button JSX**

Trong `Sidebar`, thay button cho mỗi TAB:

```tsx
<button
  key={tab.key}
  type="button"
  onClick={() => onChange(tab.key)}
  aria-current={isActive ? "page" : undefined}
  className={cn(
    "relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  )}
>
  <span
    aria-hidden
    className={cn(
      "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-all",
      isActive ? "bg-primary" : "bg-transparent",
    )}
  />
  {tab.icon}
  <span>{t(tab.labelKey)}</span>
</button>
```

Thay đổi:
- Wrap `relative` để absolute child position chính xác.
- Active dùng `bg-accent` (subtle) thay `bg-primary` (solid pill cũ).
- Accent bar `w-0.5` left side.
- Inactive hover dùng `bg-accent/60`.

- [ ] **Step 2: TS check + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: chuyển 5 tab — tab active có accent bar trái + bg accent. Inactive hover sáng nhẹ. Visual khác biệt rõ.

- [ ] **Step 3: Test light + dark theme**

1. Theme Light → tab indicator rõ ràng (primary color).
2. Theme Dark → vẫn rõ ràng.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "ui(sidebar): accent left bar + soft active state"
```

---

## Task 7: ResetButton consistency audit

**Files:**
- Modify: `src/components/settings/KeyboardScrollSection.tsx`
- Modify: `src/components/settings/TouchpadSection.tsx`
- Modify: `src/components/settings/EdgeScrollSection.tsx`
- Modify: `src/components/settings/AppearanceSection.tsx`
- Modify: `src/components/settings/BehaviorSection.tsx`

Pre-req: nếu Sub-project B đã làm Task 1-4 → dùng `useDefaults()`. Nếu chưa → tạm hardcode DEFAULTS object trong từng file với TODO comment.

Pattern chung:

```tsx
import { ResetButton } from "./ResetButton";
import { useDefaults } from "@/stores/settingsStore"; // if Sub-B done

// inside component:
const defaults = useDefaults();

// inside SettingRow with slider/value field:
{defaults && (
  <ResetButton
    onClick={() => patch({ field_name: defaults.field_name })}
    disabled={fields.field_name === defaults.field_name}
  />
)}
```

Fallback nếu `useDefaults` chưa available:
```tsx
const DEFAULTS = {
  field_name: 5, // TODO: migrate to useDefaults() (Sub-project B)
};
```

- [ ] **Step 1: KeyboardScrollSection**

Read `src/components/settings/KeyboardScrollSection.tsx`. Identify slider rows: `keyboard_pgdn_step_notches`, `keyboard_arrow_step_notches`. Bổ sung ResetButton trailing cho mỗi slider SettingRow.

TS check, smoke kéo slider → click ResetButton → snap về default.

- [ ] **Step 2: TouchpadSection**

`touchpad_pixel_multiplier`, `touchpad_acceleration_factor`. Thêm ResetButton.

Lưu ý: TouchpadSection đã rewrite trong Sub-project A, đã dùng `SettingRow`. Chỉ cần bổ sung ResetButton.

TS check + smoke.

- [ ] **Step 3: EdgeScrollSection**

`edge_scroll_zone_px`, `edge_scroll_max_notches_per_sec`. Thêm ResetButton.

TS check + smoke.

- [ ] **Step 4: AppearanceSection**

`tail_to_head_ratio` đã có ResetButton trong ScrollSection (cùng field). AppearanceSection chỉ có `easing_mode` (Select), `animation_easing` (Switch). Switch thường không cần ResetButton. Skip nếu không có numeric field.

- [ ] **Step 5: BehaviorSection**

Read file. Switch fields (boolean) không cần ResetButton — chỉ field numeric/string mới cần. Skip nếu không có.

- [ ] **Step 6: Verify mọi slider có ResetButton**

Run:
```bash
grep -rn "Slider" src/components/settings/ -l | xargs grep -L "ResetButton"
```
Expected: empty list (mọi file có Slider đều có ResetButton).

- [ ] **Step 7: TS check + smoke**

Run: `npx tsc --noEmit`
Expected: PASS.

Smoke: kéo mỗi slider lên giá trị bất kỳ → click ResetButton → slider snap về default. Khi value === default, button disabled.

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/
git commit -m "ui(settings): ResetButton consistency across all numeric sliders"
```

---

## Task 8: Manual UX smoke test

- [ ] **Step 1: Build dev**

Run: `npm run tauri dev`

- [ ] **Step 2: Test layout consistency 5 tab**

1. Chuyển qua 5 tab.
2. ✅ pass nếu mỗi tab có header (title + description) và content area scroll riêng (trừ general/about scrollable=false).
3. Title + description đúng theo 3 ngôn ngữ.

- [ ] **Step 3: Test fade transition**

1. Chuyển tab nhanh giữa Scroll → Apps → Preferences.
2. ✅ pass nếu thấy fade in 150ms mượt, không jarring, không content shift đột ngột.

- [ ] **Step 4: Test sidebar accent**

1. Click qua 5 tab.
2. ✅ pass nếu:
   - Tab active có accent bar trái màu primary, bg accent nhẹ.
   - Inactive hover có bg accent rất nhẹ.
   - Focus-visible (Tab key) có ring.
3. Test light + dark theme — accent rõ trong cả 2.

- [ ] **Step 5: Test ResetButton consistency**

1. Vào tab Scroll.
2. Mỗi slider trong ScrollSection, KeyboardScroll, Touchpad, EdgeScroll → kéo về giá trị bất kỳ → click ResetButton → snap về default.
3. ✅ pass nếu mọi slider có ResetButton functional.

- [ ] **Step 6: Test keyboard navigation**

1. Tab key qua sidebar tabs → ring focus rõ.
2. Enter để chuyển tab.
3. Tab key xuống content → focus đúng thứ tự.
4. ✅ pass nếu navigation tự nhiên, không trap.

- [ ] **Step 7: Test với window resize**

1. Resize cửa sổ nhỏ (800x600) và lớn.
2. ✅ pass nếu:
   - Header không overflow.
   - Content scroll khi cần.
   - Sidebar giữ width 11rem (w-44).
   - Max-width content giữ readable.

- [ ] **Step 8: Production build check**

Run: `npm run tauri build`
Expected: build PASS.

- [ ] **Step 9: Visual regression manual**

So sánh screenshot 5 tab trước/sau:
- ScrollSection layout không vỡ.
- Card spacing đồng nhất.
- Typography hierarchy rõ (h1 title > description > Card title > Setting label).

---

## Task 9: Optional — sticky tab header on scroll

Polish: khi user scroll trong tab dài (Scroll tab có 6 sections), tab title có thể biến mất khỏi viewport. Sticky header giải quyết.

- [ ] **Step 1: Sticky header trong TabContent**

Modify `src/components/settings/TabContent.tsx`:

```tsx
{(title || description) && (
  <div className="sticky top-0 z-10 -mx-6 border-b border-border/40 bg-background/95 px-6 pt-1 pb-3 backdrop-blur-sm space-y-0.5 shrink-0">
    {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
    {description && <p className="text-sm text-muted-foreground">{description}</p>}
  </div>
)}
```

- [ ] **Step 2: Smoke test**

Scroll xuống trong tab Scroll → header "Scroll" + description vẫn pinned trên cùng với backdrop blur.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/TabContent.tsx
git commit -m "polish(tabs): sticky header with backdrop blur on scroll"
```

---

## Task 10: Optional — keyboard shortcut 1-5 cho tab switch

- [ ] **Step 1: Listen keydown trong Settings.tsx**

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.target instanceof HTMLTextAreaElement) return;
    if ((e.target as HTMLElement)?.isContentEditable) return;
    const map: Record<string, TabKey> = {
      "1": "general",
      "2": "scroll",
      "3": "apps",
      "4": "preferences",
      "5": "about",
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      setTab(next);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

- [ ] **Step 2: Sidebar hint**

Trong `SidebarFooter`, thêm trên `Select` block:
```tsx
<p className="px-1 text-[10px] text-muted-foreground/60 text-center">
  {t("sidebar.shortcut_hint")}
</p>
```

I18n key:
- en: `"sidebar": { "shortcut_hint": "Press 1–5" }`
- vi: `"sidebar": { "shortcut_hint": "Phím 1–5" }`
- zh: `"sidebar": { "shortcut_hint": "按 1–5" }`

- [ ] **Step 3: Smoke test**

Mở app → press 1, 2, 3, 4, 5 → tab switch tương ứng.
Test edge case: focus vào input field (e.g. hotkey recorder) → press số → KHÔNG switch tab (input field consume key).

- [ ] **Step 4: Commit**

```bash
git add src/routes/Settings.tsx src/components/Sidebar.tsx src/i18n/locales/*.json
git commit -m "feat(ux): keyboard shortcuts 1-5 to switch tabs"
```
