# Sidebar Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the overcrowded "Scroll" tab into 3 focused tabs (Scroll / Devices / Advanced), rename `preferences` → `behavior`, and remove both in-app scroll-test surfaces (`TestSandboxSection`, `LivePreviewPanel`, `ScrollComparePane`).

**Architecture:** Frontend-only refactor. The sidebar `TabKey` union expands from 5 → 7 keys; `Settings.tsx` adds matching render branches; three settings/preview components are deleted; 14 locale files are updated in lockstep. Onboarding's preview engine (`ScrollPreviewArea`, `useWasmEngine`, `sampleContent`) is preserved — it has its own consumer.

**Tech Stack:** React + TypeScript, lucide-react icons, react-i18next, Tauri 2 (no backend changes).

**Spec:** [docs/superpowers/specs/2026-05-20-sidebar-reorg-design.md](../specs/2026-05-20-sidebar-reorg-design.md)

---

## File Structure

**Modified (3):**
- `src/components/Sidebar.tsx` — `TabKey` union + `TABS` array + new icon imports
- `src/routes/Settings.tsx` — drop test-surface imports/JSX, add 2 new tab branches, rename `preferences` → `behavior`, redistribute scroll-tab sections
- `src/i18n/locales/*.json` (14 files) — add `tabs.devices/advanced/behavior`, drop retired keys

**Deleted (3):**
- `src/components/settings/TestSandboxSection.tsx`
- `src/components/preview/LivePreviewPanel.tsx`
- `src/components/preview/ScrollComparePane.tsx`

**Preserved (used elsewhere):**
- `src/components/preview/ScrollPreviewArea.tsx` (onboarding)
- `src/components/preview/useWasmEngine.ts` (onboarding)
- `src/components/preview/sampleContent.tsx` (onboarding)

---

## Task 1: Update Sidebar tab definitions

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Update icon imports**

Replace the `lucide-react` import block at the top of the file:

```tsx
import {
  Activity,
  AppWindow,
  Info,
  Keyboard,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sliders,
  Sun,
  Wrench,
} from "lucide-react";
```

- [ ] **Step 2: Update the `TabKey` union**

Replace `export type TabKey = ...` with:

```tsx
export type TabKey =
  | "general"
  | "scroll"
  | "devices"
  | "advanced"
  | "apps"
  | "behavior"
  | "about";
```

- [ ] **Step 3: Update the `TABS` array**

Replace the existing `TABS` constant with:

```tsx
const TABS: TabDef[] = [
  { key: "general", labelKey: "tabs.general.label", icon: <Activity className="h-4 w-4" /> },
  { key: "scroll", labelKey: "tabs.scroll.label", icon: <Sliders className="h-4 w-4" /> },
  { key: "devices", labelKey: "tabs.devices.label", icon: <Keyboard className="h-4 w-4" /> },
  { key: "advanced", labelKey: "tabs.advanced.label", icon: <Wrench className="h-4 w-4" /> },
  { key: "apps", labelKey: "tabs.apps.label", icon: <AppWindow className="h-4 w-4" /> },
  { key: "behavior", labelKey: "tabs.behavior.label", icon: <SettingsIcon className="h-4 w-4" /> },
  { key: "about", labelKey: "tabs.about.label", icon: <Info className="h-4 w-4" /> },
];
```

- [ ] **Step 4: Type-check sidebar in isolation**

Run: `pnpm tsc --noEmit`
Expected: PASS (no errors). It will fail later in `Settings.tsx` because the `tab === "preferences"` branch references a key that no longer exists in `TabKey`. That's expected — Task 2 fixes it.

If errors are unrelated to `Settings.tsx` ("preferences" / "TestSandboxSection" / "LivePreviewPanel"), stop and investigate.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "refactor(sidebar): split Scroll into 3 tabs, rename preferences to behavior"
```

---

## Task 2: Rewire `Settings.tsx` routes

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Remove deleted component imports**

Delete these two lines from the import block at the top:

```tsx
import { TestSandboxSection } from "@/components/settings/TestSandboxSection";
import { LivePreviewPanel } from "@/components/preview/LivePreviewPanel";
```

- [ ] **Step 2: Replace the entire tab-render block**

Replace the JSX from `{tab === "general" && (...)}` through `{tab === "about" && (...)}` (lines 117-176 in the current file) with the following:

```tsx
{tab === "general" && (
  <TabContent
    title={t("tabs.general.title")}
    description={t("tabs.general.description")}
    scrollable={true}
  >
    <BatteryHint />
    <EnableHeader />
    <HealthCheck />
  </TabContent>
)}

{tab === "scroll" && (
  <TabContent
    title={t("tabs.scroll.title")}
    description={t("tabs.scroll.description")}
  >
    <ScrollSection />
    <DirectionSection />
    <AppearanceSection />
  </TabContent>
)}

{tab === "devices" && (
  <TabContent
    title={t("tabs.devices.title")}
    description={t("tabs.devices.description")}
  >
    <KeyboardScrollSection />
    <TouchpadSection />
  </TabContent>
)}

{tab === "advanced" && (
  <TabContent
    title={t("tabs.advanced.title")}
    description={t("tabs.advanced.description")}
  >
    <PrecisionActionsSection />
    <EdgeScrollSection />
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

{tab === "behavior" && (
  <TabContent
    title={t("tabs.behavior.title")}
    description={t("tabs.behavior.description")}
  >
    <BehaviorSection />
    <GameModeSection />
  </TabContent>
)}

{tab === "about" && (
  <TabContent
    title={t("tabs.about.title")}
    description={t("tabs.about.description")}
    scrollable={true}
  >
    <AboutSection />
    <BackupSection />
    <StatsSection />
  </TabContent>
)}
```

- [ ] **Step 3: Type-check the project**

Run: `pnpm tsc --noEmit`
Expected: PASS (no errors).

If errors mention `TestSandboxSection` or `LivePreviewPanel`, you missed an import in Step 1.
If errors mention `tab === "preferences"`, you missed the rename in Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "refactor(settings): rewire routes for new sidebar structure"
```

---

## Task 3: Delete obsolete components

**Files:**
- Delete: `src/components/settings/TestSandboxSection.tsx`
- Delete: `src/components/preview/LivePreviewPanel.tsx`
- Delete: `src/components/preview/ScrollComparePane.tsx`

- [ ] **Step 1: Verify no other consumers**

Run grep to confirm nothing else imports these:

```bash
grep -rn "TestSandboxSection\|LivePreviewPanel\|ScrollComparePane" src
```

Expected output: only matches inside the three files themselves (their own export declarations). If any other file imports them, stop and investigate.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/settings/TestSandboxSection.tsx
rm src/components/preview/LivePreviewPanel.tsx
rm src/components/preview/ScrollComparePane.tsx
```

- [ ] **Step 3: Type-check the project**

Run: `pnpm tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove in-app scroll-test surfaces"
```

---

## Task 4: Update English locale (`en.json`)

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Replace the `tabs` block**

Find the `"tabs": { ... }` object (around line 129) and replace its contents with:

```json
  "tabs": {
    "general": {
      "label": "General",
      "title": "General",
      "description": "Quick toggles and health checks."
    },
    "scroll": {
      "label": "Scroll",
      "title": "Scroll",
      "description": "Step size, easing, direction, and look."
    },
    "devices": {
      "label": "Devices",
      "title": "Input devices",
      "description": "Keyboard and touchpad smoothing."
    },
    "advanced": {
      "label": "Advanced",
      "title": "Advanced",
      "description": "Precision modifiers and edge auto-scroll."
    },
    "apps": {
      "label": "Apps",
      "title": "Per-app",
      "description": "Profiles and exclusions tailored to specific applications."
    },
    "behavior": {
      "label": "Behavior",
      "title": "Behavior",
      "description": "App behavior, hotkeys, and game mode."
    },
    "about": {
      "label": "About",
      "title": "About",
      "description": "Version, updates, and logs."
    }
  },
```

- [ ] **Step 2: Remove retired keys**

Delete the following top-level blocks (still in `en.json`):

- The `"preview_hint": { ... }` block.
- The `"test_scroll": { ... }` block.
- The `"compare": { ... }` block.
- Inside the `"section": { ... }` block, delete the `"test_scroll": "Test scrolling"` line.

Make sure remaining JSON is still valid (mind trailing commas).

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))"`
Expected: exits 0 with no output.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json
git commit -m "i18n(en): tabs reorg, drop test-scroll/compare/preview_hint"
```

---

## Task 5: Update remaining 13 locales

**Files (13):**
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/hi.json`
- Modify: `src/i18n/locales/id.json`
- Modify: `src/i18n/locales/it.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`
- Modify: `src/i18n/locales/pt-BR.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `src/i18n/locales/zh.json`

For **each** locale file: (a) replace the `"tabs"` block using the per-language values below, (b) delete the same retired blocks listed in Task 4 Step 2 (if present), (c) update the `tabs.general.description` to match the new "Quick toggles and health checks" intent in that language. Keep existing keys you don't touch unchanged.

Note: descriptions use the same intent across languages. If a locale already has a description for `general`/`scroll`/`apps`/`about` that you prefer to keep verbatim, you may keep the existing translation — only the *new* keys (`devices`, `advanced`, `behavior`) and any reference to the now-removed `LivePreviewPanel`/`TestSandbox` ("live test" / "test scroll" wording in `general.description`) must change.

### Per-locale label/title/description values

#### `de.json` (German)

```json
  "tabs": {
    "general": { "label": "Allgemein", "title": "Allgemein", "description": "Schnellschalter und Health-Checks." },
    "scroll": { "label": "Scrollen", "title": "Scrollen", "description": "Schrittgröße, Easing, Richtung und Optik." },
    "devices": { "label": "Geräte", "title": "Eingabegeräte", "description": "Tastatur- und Touchpad-Smoothing." },
    "advanced": { "label": "Erweitert", "title": "Erweitert", "description": "Präzisions-Modifikatoren und Rand-Autoscroll." },
    "apps": { "label": "Apps", "title": "Pro App", "description": "Profile und Ausschlüsse für bestimmte Anwendungen." },
    "behavior": { "label": "Verhalten", "title": "Verhalten", "description": "App-Verhalten, Hotkeys und Spielmodus." },
    "about": { "label": "Info", "title": "Info", "description": "Version, Updates und Logs." }
  }
```

#### `es.json` (Spanish)

```json
  "tabs": {
    "general": { "label": "General", "title": "General", "description": "Conmutadores rápidos y comprobaciones de estado." },
    "scroll": { "label": "Desplazamiento", "title": "Desplazamiento", "description": "Tamaño del paso, easing, dirección y apariencia." },
    "devices": { "label": "Dispositivos", "title": "Dispositivos de entrada", "description": "Suavizado de teclado y panel táctil." },
    "advanced": { "label": "Avanzado", "title": "Avanzado", "description": "Modificadores de precisión y auto-desplazamiento de borde." },
    "apps": { "label": "Apps", "title": "Por aplicación", "description": "Perfiles y exclusiones adaptados a aplicaciones específicas." },
    "behavior": { "label": "Comportamiento", "title": "Comportamiento", "description": "Comportamiento de la app, atajos y modo juego." },
    "about": { "label": "Acerca de", "title": "Acerca de", "description": "Versión, actualizaciones y registros." }
  }
```

#### `fr.json` (French)

```json
  "tabs": {
    "general": { "label": "Général", "title": "Général", "description": "Bascules rapides et contrôles d'état." },
    "scroll": { "label": "Défilement", "title": "Défilement", "description": "Taille du pas, lissage, direction et apparence." },
    "devices": { "label": "Périphériques", "title": "Périphériques d'entrée", "description": "Lissage clavier et pavé tactile." },
    "advanced": { "label": "Avancé", "title": "Avancé", "description": "Modificateurs de précision et défilement automatique des bords." },
    "apps": { "label": "Applis", "title": "Par application", "description": "Profils et exclusions adaptés à chaque application." },
    "behavior": { "label": "Comportement", "title": "Comportement", "description": "Comportement de l'appli, raccourcis et mode jeu." },
    "about": { "label": "À propos", "title": "À propos", "description": "Version, mises à jour et journaux." }
  }
```

#### `hi.json` (Hindi)

```json
  "tabs": {
    "general": { "label": "सामान्य", "title": "सामान्य", "description": "क्विक टॉगल और हेल्थ चेक।" },
    "scroll": { "label": "स्क्रॉल", "title": "स्क्रॉल", "description": "स्टेप साइज़, ईज़िंग, दिशा और रूप।" },
    "devices": { "label": "डिवाइस", "title": "इनपुट डिवाइस", "description": "कीबोर्ड और टचपैड स्मूथिंग।" },
    "advanced": { "label": "उन्नत", "title": "उन्नत", "description": "सटीकता मॉडिफ़ायर और एज ऑटो-स्क्रॉल।" },
    "apps": { "label": "ऐप्स", "title": "प्रति-ऐप", "description": "विशिष्ट ऐप्लिकेशन के लिए प्रोफ़ाइल और अपवर्जन।" },
    "behavior": { "label": "व्यवहार", "title": "व्यवहार", "description": "ऐप व्यवहार, हॉटकी और गेम मोड।" },
    "about": { "label": "जानकारी", "title": "जानकारी", "description": "संस्करण, अपडेट और लॉग।" }
  }
```

#### `id.json` (Indonesian)

```json
  "tabs": {
    "general": { "label": "Umum", "title": "Umum", "description": "Tombol cepat dan pemeriksaan status." },
    "scroll": { "label": "Scroll", "title": "Scroll", "description": "Ukuran langkah, easing, arah, dan tampilan." },
    "devices": { "label": "Perangkat", "title": "Perangkat input", "description": "Penghalusan keyboard dan touchpad." },
    "advanced": { "label": "Lanjutan", "title": "Lanjutan", "description": "Modifier presisi dan auto-scroll tepi." },
    "apps": { "label": "Aplikasi", "title": "Per aplikasi", "description": "Profil dan pengecualian khusus untuk aplikasi tertentu." },
    "behavior": { "label": "Perilaku", "title": "Perilaku", "description": "Perilaku aplikasi, hotkey, dan mode game." },
    "about": { "label": "Tentang", "title": "Tentang", "description": "Versi, pembaruan, dan log." }
  }
```

#### `it.json` (Italian)

```json
  "tabs": {
    "general": { "label": "Generale", "title": "Generale", "description": "Interruttori rapidi e controlli di stato." },
    "scroll": { "label": "Scorrimento", "title": "Scorrimento", "description": "Dimensione del passo, easing, direzione e aspetto." },
    "devices": { "label": "Dispositivi", "title": "Dispositivi di input", "description": "Smoothing tastiera e touchpad." },
    "advanced": { "label": "Avanzate", "title": "Avanzate", "description": "Modificatori di precisione e auto-scorrimento ai bordi." },
    "apps": { "label": "App", "title": "Per app", "description": "Profili ed esclusioni per applicazioni specifiche." },
    "behavior": { "label": "Comportamento", "title": "Comportamento", "description": "Comportamento app, scorciatoie e modalità gioco." },
    "about": { "label": "Info", "title": "Info", "description": "Versione, aggiornamenti e log." }
  }
```

#### `ja.json` (Japanese)

```json
  "tabs": {
    "general": { "label": "一般", "title": "一般", "description": "クイックトグルとヘルスチェック。" },
    "scroll": { "label": "スクロール", "title": "スクロール", "description": "ステップサイズ、イージング、方向、外観。" },
    "devices": { "label": "デバイス", "title": "入力デバイス", "description": "キーボードとタッチパッドのスムージング。" },
    "advanced": { "label": "詳細", "title": "詳細", "description": "精密モディファイアとエッジオートスクロール。" },
    "apps": { "label": "アプリ", "title": "アプリ別", "description": "特定のアプリ向けのプロファイルと除外設定。" },
    "behavior": { "label": "動作", "title": "動作", "description": "アプリの動作、ホットキー、ゲームモード。" },
    "about": { "label": "情報", "title": "情報", "description": "バージョン、アップデート、ログ。" }
  }
```

#### `ko.json` (Korean)

```json
  "tabs": {
    "general": { "label": "일반", "title": "일반", "description": "빠른 토글과 상태 점검." },
    "scroll": { "label": "스크롤", "title": "스크롤", "description": "스텝 크기, 이징, 방향, 외관." },
    "devices": { "label": "장치", "title": "입력 장치", "description": "키보드와 터치패드 스무딩." },
    "advanced": { "label": "고급", "title": "고급", "description": "정밀 수정자와 가장자리 자동 스크롤." },
    "apps": { "label": "앱", "title": "앱별", "description": "특정 앱에 맞춘 프로필과 제외 설정." },
    "behavior": { "label": "동작", "title": "동작", "description": "앱 동작, 단축키, 게임 모드." },
    "about": { "label": "정보", "title": "정보", "description": "버전, 업데이트, 로그." }
  }
```

#### `pt-BR.json` (Portuguese — Brazil)

```json
  "tabs": {
    "general": { "label": "Geral", "title": "Geral", "description": "Interruptores rápidos e verificações de saúde." },
    "scroll": { "label": "Rolagem", "title": "Rolagem", "description": "Tamanho do passo, easing, direção e aparência." },
    "devices": { "label": "Dispositivos", "title": "Dispositivos de entrada", "description": "Suavização de teclado e touchpad." },
    "advanced": { "label": "Avançado", "title": "Avançado", "description": "Modificadores de precisão e rolagem automática de borda." },
    "apps": { "label": "Apps", "title": "Por aplicativo", "description": "Perfis e exclusões adaptados a aplicativos específicos." },
    "behavior": { "label": "Comportamento", "title": "Comportamento", "description": "Comportamento do app, atalhos e modo jogo." },
    "about": { "label": "Sobre", "title": "Sobre", "description": "Versão, atualizações e logs." }
  }
```

#### `ru.json` (Russian)

```json
  "tabs": {
    "general": { "label": "Общие", "title": "Общие", "description": "Быстрые переключатели и проверки состояния." },
    "scroll": { "label": "Прокрутка", "title": "Прокрутка", "description": "Размер шага, easing, направление и внешний вид." },
    "devices": { "label": "Устройства", "title": "Устройства ввода", "description": "Сглаживание клавиатуры и тачпада." },
    "advanced": { "label": "Расширенные", "title": "Расширенные", "description": "Модификаторы точности и автопрокрутка у края." },
    "apps": { "label": "Приложения", "title": "По приложениям", "description": "Профили и исключения для конкретных приложений." },
    "behavior": { "label": "Поведение", "title": "Поведение", "description": "Поведение приложения, горячие клавиши и игровой режим." },
    "about": { "label": "О программе", "title": "О программе", "description": "Версия, обновления и журналы." }
  }
```

#### `tr.json` (Turkish)

```json
  "tabs": {
    "general": { "label": "Genel", "title": "Genel", "description": "Hızlı düğmeler ve durum kontrolleri." },
    "scroll": { "label": "Kaydırma", "title": "Kaydırma", "description": "Adım boyutu, easing, yön ve görünüm." },
    "devices": { "label": "Cihazlar", "title": "Giriş cihazları", "description": "Klavye ve dokunmatik yüzey yumuşatma." },
    "advanced": { "label": "Gelişmiş", "title": "Gelişmiş", "description": "Hassasiyet değiştiricileri ve kenar otomatik kaydırma." },
    "apps": { "label": "Uygulamalar", "title": "Uygulama başına", "description": "Belirli uygulamalara özel profiller ve hariç tutmalar." },
    "behavior": { "label": "Davranış", "title": "Davranış", "description": "Uygulama davranışı, kısayollar ve oyun modu." },
    "about": { "label": "Hakkında", "title": "Hakkında", "description": "Sürüm, güncellemeler ve günlükler." }
  }
```

#### `vi.json` (Vietnamese)

```json
  "tabs": {
    "general": { "label": "Chung", "title": "Chung", "description": "Bật/tắt nhanh và kiểm tra trạng thái." },
    "scroll": { "label": "Cuộn", "title": "Cuộn", "description": "Bước cuộn, easing, hướng và giao diện." },
    "devices": { "label": "Thiết bị", "title": "Thiết bị nhập", "description": "Làm mượt bàn phím và touchpad." },
    "advanced": { "label": "Nâng cao", "title": "Nâng cao", "description": "Phím bổ trợ chính xác và tự cuộn ở mép." },
    "apps": { "label": "Ứng dụng", "title": "Theo ứng dụng", "description": "Profile và loại trừ riêng cho từng ứng dụng." },
    "behavior": { "label": "Hành vi", "title": "Hành vi", "description": "Hành vi ứng dụng, phím tắt và chế độ game." },
    "about": { "label": "Thông tin", "title": "Thông tin", "description": "Phiên bản, cập nhật và log." }
  }
```

#### `zh.json` (Chinese — Simplified)

```json
  "tabs": {
    "general": { "label": "通用", "title": "通用", "description": "快速切换与状态检查。" },
    "scroll": { "label": "滚动", "title": "滚动", "description": "步长、缓动、方向和外观。" },
    "devices": { "label": "设备", "title": "输入设备", "description": "键盘和触控板平滑。" },
    "advanced": { "label": "高级", "title": "高级", "description": "精确修饰键和边缘自动滚动。" },
    "apps": { "label": "应用", "title": "按应用", "description": "针对特定应用的配置和排除项。" },
    "behavior": { "label": "行为", "title": "行为", "description": "应用行为、热键和游戏模式。" },
    "about": { "label": "关于", "title": "关于", "description": "版本、更新和日志。" }
  }
```

### Validation steps (run once after all 13 are edited)

- [ ] **Step 1: Validate every locale file is valid JSON**

```bash
for f in src/i18n/locales/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "INVALID: $f"
done
```

Expected: no `INVALID:` lines.

- [ ] **Step 2: Confirm retired keys are gone**

```bash
grep -l "preview_hint\|test_scroll\|\"compare\":\|\"preferences\":" src/i18n/locales/*.json || echo "clean"
```

Expected: prints `clean`. (If any file still references those keys, finish removing them. Note: matches inside larger key names — e.g. `keyboard_test_scroll` — would be false positives, but none exist in this repo.)

- [ ] **Step 3: Confirm new keys exist in every locale**

```bash
for f in src/i18n/locales/*.json; do
  node -e "
    const d=JSON.parse(require('fs').readFileSync('$f','utf8'));
    const t=d.tabs||{};
    const need=['devices','advanced','behavior'];
    const miss=need.filter(k=>!t[k]||!t[k].label);
    if(miss.length) console.error('$f missing:',miss.join(','));
  "
done
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n: tabs reorg across 13 remaining locales"
```

---

## Task 6: End-to-end verification

- [ ] **Step 1: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Build the frontend**

Run: `pnpm build`
Expected: succeeds without warnings about missing modules. The output should not mention `TestSandboxSection`, `LivePreviewPanel`, or `ScrollComparePane`.

- [ ] **Step 3: Rust sanity check**

Run: `cd src-tauri && cargo check && cd ..`
Expected: PASS. (Rust was not modified, but confirm nothing else is broken.)

- [ ] **Step 4: Manual smoke (dev server)**

Run: `pnpm tauri dev`

Verify in the running app:
- Sidebar shows 7 tabs in this order: General, Scroll, Devices, Advanced, Apps, Behavior, About.
- Each tab renders its expected sections (per the spec table).
- No console errors mentioning missing translation keys.
- Onboarding wizard still shows the live preview area (open settings as a fresh user, or temporarily clear `onboarding_completed_at`).
- Tray menu's "Excluded apps" entry still navigates to the **Apps** tab.

Stop the dev server.

- [ ] **Step 5: Final commit (if smoke surfaced any fix)**

If you had to tweak anything during smoke:

```bash
git add -A
git commit -m "fix: post-reorg smoke fixes"
```

If everything passed first time, no extra commit needed.

---

## Notes for the implementer

- **Order matters.** Do Task 1 → 2 → 3 in sequence; the type-checker enforces correctness between them. Locale tasks (4 → 5) can be in either order but all must finish before the final smoke (Task 6).
- **Do not touch** `src/components/preview/ScrollPreviewArea.tsx`, `useWasmEngine.ts`, or `sampleContent.tsx` — `OnboardingWizard.tsx` still imports them.
- **Do not touch** Rust code. The `navigate_to` command stays generic; the only emitter (`TrayPanel.tsx`) emits `'excluded-apps'` which the Settings listener already maps to `tab="apps"`.
- **If a locale file is missing keys you don't recognize**, leave them alone — only the keys this plan names should be added/removed. Other unrelated translation drift is out of scope.
