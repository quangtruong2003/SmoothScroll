# Per-version "What's new" highlights auto-pulled from CHANGELOG.md

**Date:** 2026-07-07
**Status:** Draft (pre-approval)
**Scope:** Refactor hệ thống thông báo "Có gì mới" để mỗi version tự động hiển thị highlights tương ứng — thay vì cứng nhắc một entry cũ (`0.2.0`) cho mọi phiên bản từ 0.2.0 đến nay. Giải quyết vấn đề user phàn nàn: thông báo "có gì mới" giống nhau qua tất cả các bản cập nhật.

---

## 1. Background / Root cause

### 1a. Hiện trạng — thông báo "có gì mới" bị stale

File `src/components/WhatsNewModal.tsx` đã được implement từ commit `7693157` (2026-05-21). Tuy nhiên dữ liệu hiển thị bị hardcode cứng nhắc:

```tsx
const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    highlightKeys: [
      "whatsnew.highlights.0_2_0.onboarding",
      "whatsnew.highlights.0_2_0.permission",
      "whatsnew.highlights.0_2_0.feel_hints",
      "whatsnew.highlights.0_2_0.cheatsheet",
      "whatsnew.highlights.0_2_0.backup",
    ],
  },
];
```

Logic match ở dòng 67-68:

```tsx
const entry =
  CHANGELOG.find((e) => version.startsWith(e.version)) ?? CHANGELOG[0];
```

App hiện tại đã ở version `1.11.0` (theo `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — single source of truth: `Cargo.toml [workspace.package]`). Tất cả user từ 0.2.0 → 1.11.0 đều thấy highlights của `0.2.0` (onboarding, permission flow, feel hints, cheat sheet, backup) — mặc dù app đã thêm rất nhiều features mới: Wayland support, native UI theming, Linux support, touchpad detection, platform status command, v.v.

User đã xác nhận trong session brainstorming: "qua các phiên bản nó vẫn đang giống nhau" — đúng 100%.

### 1b. CHANGELOG.md đã có data — chỉ thiếu pipeline kéo về

File `CHANGELOG.md` (391 dòng) chứa entries đầy đủ từ `0.1.0` đến `1.11.0` được auto-generate bởi `scripts/version-bump.mjs:109-133` theo format Keep a Changelog 1.1.0:

```markdown
## [1.11.0] - 2026-07-03

### Added
- native UI theming + platform bugfixes
- show beta warning for Linux and macOS users
- add Linux support to download page

### Fixed
- show correct download label for Linux users
```

Mỗi lần release, `auto-release.yml` chạy `scripts/version-bump.mjs`:
1. Đọc commits từ last tag theo Conventional Commits.
2. Group theo type → Added (feat) / Fixed (fix) / Performance (perf) / Changed (refactor, không breaking).
3. Insert `## [X.Y.Z] - YYYY-MM-DD` ngay sau `## [Unreleased]`.

→ Single source of truth đã có sẵn, chỉ cần front-end đọc và hiển thị.

### 1c. Các gaps nhỏ khác

- `whatsnew.view_changelog` key đã có trong 14 locale files nhưng không được render (orphan).
- `whatsnew.highlights.0_2_0.*` (5 keys × 14 locales = 70 keys) sẽ thành dead code sau refactor.
- Không có cách nào để user xem lại highlights khi đã dismiss (chỉ show one-shot per version).
- Forced update flow (`ForcedUpdateModal.tsx`) dùng `update.body` từ GitHub release notes — không thuộc scope bài này.

---

## 2. Goals

1. **Auto-pull highlights từ CHANGELOG.md** theo current version — zero manual sync, build pipeline không đổi.
2. **Hiển thị đúng content của version mới** — user update 1.10 → 1.11 thấy highlights 1.11, update 1.5 → 1.11 thấy highlights 1.11 (latest only, không cumulative).
3. **Robust edge cases** — version không có trong CHANGELOG (dev build), CHANGELOG parse fail, pre-release suffix, version có 0 items.
4. **Manual trigger** — Settings > About có nút "Show release notes" để user xem lại bất cứ lúc nào.
5. **Cleanup i18n orphan keys** — xóa `whatsnew.highlights.0_2_0.*` ở 14 locale files.
6. **Không thay đổi build pipeline / Rust / Tauri config.**

## 3. Non-goals

- Không localize commit messages (giữ English — Keep a Changelog format chuẩn).
- Không cumulative highlights qua nhiều version (chỉ current).
- Không markdown rendering trong modal (chỉ plain bullets).
- Không touch `ForcedUpdateModal` (flow tách biệt cho critical updates).
- Không notification ngoài app (system tray, push) — chỉ modal khi mở app.
- Không persist "read receipts" ở backend (giữ localStorage đơn giản).

---

## 4. Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Build time                                                 │
│                                                             │
│  Conventional Commits → auto-release.yml                    │
│         │                                                    │
│         ▼                                                    │
│  scripts/version-bump.mjs                                  │
│         │                                                    │
│         ├─→ Cargo.toml, package.json, tauri.conf.json       │
│         └─→ CHANGELOG.md  (## [1.11.0] - 2026-07-03)       │
│                                                             │
│  Vite raw import (?raw) bundles CHANGELOG.md vào JS        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Runtime (per app launch)                                   │
│                                                             │
│  App.tsx mounts → WhatsNewModal                            │
│         │                                                    │
│         ├─→ tauri.appVersion()  → "1.11.0"                  │
│         ├─→ localStorage.getItem("ss.whatsnew.lastSeenVersion")│
│         │                                                    │
│         ▼                                                    │
│  Nếu lastSeenVersion != currentVersion:                    │
│         ├─→ Parse bundled CHANGELOG.md                     │
│         ├─→ Extract entry cho "1.11.0"                     │
│         ├─→ Group commits theo section                     │
│         └─→ Show modal with highlights                     │
│                                                             │
│  User dismisses → setItem(lastSeenVersion, currentVersion) │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Manual trigger (anytime)                                   │
│                                                             │
│  Settings > About tab → nút "Show release notes"           │
│         │                                                    │
│         └─→ window.dispatchEvent("whatsnew:open")           │
│             → WhatsNewModal mở với version hiện tại        │
│               (KHÔNG update localStorage)                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Parser — pure function

**File mới:** `src/lib/changelogParser.ts`

```ts
export interface ChangelogSection {
  kind: "Added" | "Fixed" | "Performance" | "Changed";
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

export function parseChangelog(
  raw: string,
  targetVersion: string
): ChangelogEntry | null;
```

**Algorithm:**
1. Scan lines, tìm block `## [X.Y.Z] - YYYY-MM-DD` (regex `^## \[(\d+\.\d+\.\d+([-.+][\w.]+)?)\] - (\d{4}-\d{2}-\d{2})?`).
2. Trích `version` (capture 1) và optional `date` (capture 3).
3. Trong block đó, scan subsections `### (Added|Fixed|Performance|Changed|...)`.
4. Chỉ accept 4 kinds: `Added`, `Fixed`, `Performance`, `Changed`. Bỏ qua `Removed`, `Deprecated`, `Security` (low value cho user-facing modal).
5. Mỗi bullet `- xxx` hoặc `* xxx` trong subsection → thêm vào items.
6. Stop khi gặp `## [` tiếp theo.
7. Bỏ qua blank lines, indented continuation lines, nested sub-bullets (chỉ lấy top-level bullets).

**Matching strategy (thử theo thứ tự):**
1. Exact match `targetVersion`.
2. Strip pre-release suffix (`1.11.0-beta.1` → `1.11.0`) rồi exact match.
3. Match `major.minor` (vd `1.11.x` → trả về entry `1.11.0` hoặc `1.11.x` cao nhất).
4. Trả về entry mới nhất trong CHANGELOG (fallback cuối cùng).
5. Nếu CHANGELOG rỗng hoặc parse lỗi → return `null`.

**Properties:**
- Pure (no I/O, no async).
- Deterministic.
- Throw `ParseError` chỉ khi format corrupted irrecoverably (vd `### Added` xuất hiện 2 lần trong cùng block). Caller catch gracefully.

### 4.3 WhatsNewModal — refactor

**File sửa:** `src/components/WhatsNewModal.tsx`

**Thay đổi:**

```tsx
import rawChangelog from "@/lib/CHANGELOG.md?raw";
import { parseChangelog } from "@/lib/changelogParser";

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualTrigger, setManualTrigger] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await tauri.appVersion().catch(() => null);
      if (!v || cancelled) return;
      setVersion(v);
      const last = localStorage.getItem(STORAGE_KEY);
      if (last == null || compareVersions(v, last) > 0 || manualTrigger) {
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [manualTrigger]);

  // Manual trigger via custom event
  useEffect(() => {
    const handler = () => setManualTrigger(true);
    window.addEventListener("whatsnew:open", handler);
    return () => window.removeEventListener("whatsnew:open", handler);
  }, []);

  const dismiss = () => {
    if (version && !manualTrigger) {
      try { localStorage.setItem(STORAGE_KEY, version); } catch {}
    }
    setManualTrigger(false);
    setOpen(false);
  };

  if (!open || !version) return null;

  let entry: ChangelogEntry | null = null;
  try {
    entry = parseChangelog(rawChangelog, version);
  } catch (e) {
    console.warn("[WhatsNew] failed to parse CHANGELOG.md:", e);
  }

  if (!entry) return null;

  const totalItems = entry.sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[55] ...">
      {/* header, tagline như cũ */}
      
      {totalItems === 0 ? (
        <p className="text-sm text-muted-foreground mb-5">
          {t("whatsnew.minor_fixes_only")}
        </p>
      ) : (
        <div className="mb-5 space-y-4 max-h-[50vh] overflow-y-auto">
          {entry.sections.map((section) => (
            <section key={section.kind}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t(`whatsnew.section_${section.kind.toLowerCase()}`)}
              </h3>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openExternal(`https://github.com/quangtruong2003/SmoothScroll/releases/tag/v${version.split("-")[0]}`)}
          className="text-sm text-primary hover:underline"
        >
          {t("whatsnew.view_changelog")} →
        </button>
        <Button onClick={dismiss}>{t("whatsnew.dismiss")}</Button>
      </div>
    </div>
  );
}
```

**Helper `openExternal`:** dùng `@tauri-apps/plugin-shell` `open()` để mở URL ngoài browser mặc định. Pattern đã có sẵn trong codebase (kiểm tra trong implementation plan ở các chỗ khác dùng `openExternal` hoặc `tauri-plugin-shell`); nếu chưa có thì thêm dependency và wrap trong helper nội bộ. Trong modal gọi:

```ts
await openExternal(`https://github.com/quangtruong2003/SmoothScroll/releases/tag/v${version.split("-")[0]}`);
```

Lưu ý: `version.split("-")[0]` để strip pre-release suffix (`1.11.0-beta.1` → `1.11.0`) trước khi build URL GitHub.

### 4.4 AboutSection — nút "Show release notes"

**File sửa:** `src/components/settings/AboutSection.tsx`

Thêm nút ngay sau version display (dòng 29-34 hiện tại):

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => window.dispatchEvent(new CustomEvent("whatsnew:open"))}
>
  {t("about.show_release_notes")}
</Button>
```

**Vị trí:** Trong `Card` chứa version info, dưới `appVersion` text. Style: outline button, `size="sm"` để không dominate layout.

### 4.5 CHANGELOG.md bundle strategy

**Option 1 (Recommended):** Copy `CHANGELOG.md` → `src/lib/CHANGELOG.md` (git tracked). Vite raw import `?raw`. Simple, no extra plugin.

**Option 2:** `vite-plugin-static-copy` từ root `./CHANGELOG.md` → `src/assets/`. Phức tạp hơn, không có lợi rõ ràng.

**Decision:** Option 1. Bundle size impact ~3-5KB gzipped. Trade-off chấp nhận được cho instant offline access.

**Symlink alternative:** Có thể dùng symlink `src/lib/CHANGELOG.md` → `../../CHANGELOG.md` để tránh duplicate. Trên Windows cần admin privilege — không portable. Decision: hard copy, sync thủ công qua pre-commit hook hoặc build step.

**Implementation:** Trong plan sẽ có script `scripts/sync-changelog.mjs` chạy trong `prebuild` để copy root `CHANGELOG.md` → `src/lib/CHANGELOG.md`. Đảm bảo bundle luôn sync với file ở root.

### 4.6 Sequence — first launch sau khi update

```
App start
  ↓
App.tsx → render Settings (route mặc định) → render <WhatsNewModal />
  ↓
useEffect chạy:
  ├─→ tauri.appVersion() → "1.11.0"
  ├─→ localStorage.getItem("ss.whatsnew.lastSeenVersion") → "1.10.5"
  ├─→ compareVersions("1.11.0", "1.10.5") > 0 → TRUE
  └─→ setOpen(true)
  ↓
Render modal:
  ├─→ import raw CHANGELOG.md
  ├─→ parseChangelog(raw, "1.11.0") → entry { version: "1.11.0", sections: [...] }
  ├─→ Render Added section (3 items), Fixed section (1 item)
  └─→ Hiển thị
  ↓
User click "Got it":
  ├─→ manualTrigger = false → setItem("ss.whatsnew.lastSeenVersion", "1.11.0")
  └─→ setOpen(false)
  ↓
Next launch → setItem == version → modal KHÔNG hiện
```

### 4.7 Sequence — manual trigger từ About

```
User vào Settings > About
  ↓
Click nút "Show release notes"
  ↓
window.dispatchEvent(new CustomEvent("whatsnew:open"))
  ↓
WhatsNewModal useEffect bắt event → setManualTrigger(true)
  ↓
useEffect [manualTrigger] re-run:
  ├─→ tauri.appVersion() → "1.11.0" (cached or fresh)
  ├─→ manualTrigger = true → setOpen(true) (override version check)
  └─→ Render modal với same content
  ↓
User dismiss:
  ├─→ manualTrigger = true → KHÔNG setItem localStorage
  └─→ setManualTrigger(false), setOpen(false)
  ↓
Next launch normal: vẫn hiện modal (vì lastSeenVersion vẫn cũ)
```

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/components/WhatsNewModal.tsx` | Refactor: xóa hardcoded `CHANGELOG` array, dùng `parseChangelog` + `?raw` import. Thêm sections UI (Added/Fixed/Performance/Changed), 2-nút footer (View full changelog + Got it), custom event listener. |
| `src/lib/changelogParser.ts` (NEW) | Pure parser function. ~100 LOC. Export `ChangelogEntry`, `ChangelogSection`, `parseChangelog`. |
| `src/lib/changelogParser.test.ts` (NEW) | Vitest unit tests cho parser edge cases. ~150 LOC. |
| `src/lib/CHANGELOG.md` (NEW) | Copy từ root `CHANGELOG.md` qua `scripts/sync-changelog.mjs` (prebuild). |
| `scripts/sync-changelog.mjs` (NEW) | Tiny script: `fs.copyFileSync('CHANGELOG.md', 'src/lib/CHANGELOG.md')`. Wire vào `prebuild` script. |
| `src/components/settings/AboutSection.tsx` | Thêm nút "Show release notes" → dispatch `whatsnew:open` event. |
| `src/i18n/locales/en.json` | Thêm `whatsnew.section_added/fixed/performance/changed`, `whatsnew.minor_fixes_only`, `about.show_release_notes`. Xóa `whatsnew.highlights.0_2_0.*`. |
| `src/i18n/locales/vi.json` | Same keys tiếng Việt. Xóa `whatsnew.highlights.0_2_0.*`. |
| `src/i18n/locales/{de,fr,es,it,ja,ko,zh,ru,id,pt-BR,tr,hi}.json` (×12) | Same pattern cho mỗi locale. |
| `package.json` | Thêm `"prebuild": "node scripts/sync-changelog.mjs"` script. Thêm `"test:parser": "vitest src/lib/changelogParser.test.ts"` nếu chưa có. |

**Không thay đổi:**
- `src-tauri/**` (no Rust changes)
- `scripts/version-bump.mjs` (giữ nguyên — đã đúng)
- `.github/workflows/auto-release.yml` (giữ nguyên)
- `Cargo.toml`, `package.json` version (giữ nguyên)

---

## 6. Testing

### Automated tests (Vitest)

`src/lib/changelogParser.test.ts`:

- ✅ `parseChangelog` với valid input + exact version match → returns parsed entry
- ✅ Strip pre-release suffix (`1.11.0-beta.1` → matches `1.11.0`)
- ✅ Version không tồn tại exact → fallback major.minor
- ✅ Version hoàn toàn không có → fallback latest entry
- ✅ Empty CHANGELOG → `null`
- ✅ Malformed CHANGELOG (no `## [` markers) → `null`, no throw
- ✅ Duplicate `### Added` block → lấy cái đầu
- ✅ Section không có items → không có trong output
- ✅ Multi-line continuation bullets bị bỏ qua
- ✅ Stop đúng tại `## [` tiếp theo
- ✅ Chỉ accept 4 kinds (Added/Fixed/Performance/Changed), bỏ Removed/Deprecated/Security

### Manual checklist

- [ ] Build app local ở version 1.11.0, install, launch → modal hiện với highlights 1.11.0 (Added: native UI theming, beta warning, Linux download; Fixed: download label)
- [ ] Click "Got it" → modal đóng, dev tools check `localStorage.getItem("ss.whatsnew.lastSeenVersion") === "1.11.0"`
- [ ] Re-launch app → modal không hiện
- [ ] Dev tools: `localStorage.setItem("ss.whatsnew.lastSeenVersion", "1.10.0")` → re-launch → modal hiện lại
- [ ] Settings > About → click "Show release notes" → modal mở với content 1.11.0
- [ ] Click "View full changelog" → browser mở `https://github.com/quangtruong2003/SmoothScroll/releases/tag/v1.11.0`
- [ ] Switch locale sang VI, EN, JA → section labels dịch đúng ("Đã thêm", "Added", "追加")
- [ ] Test dev build với version `1.11.0-dev` (không có trong CHANGELOG) → fallback 1.11.0, modal vẫn hiện
- [ ] Test scenario CHANGELOG corrupted (rename file, restart) → modal silent skip, app vẫn hoạt động bình thường
- [ ] Test scenario localStorage disabled (incognito mode) → modal vẫn mở/đóng được, warning trong console

---

## 7. Rollout

- **Risk:** Thấp. Parser pure function với fallback chain robust, modal skip khi lỗi, không touch Rust/build pipeline.
- **Rollback:** Revert 1 commit. No DB migration, no schema change.
- **Build:** Local `pnpm run build:wasm` (nếu cần) → `pnpm run prebuild` (sync CHANGELOG) → `cd src-tauri && npx tauri build`. Test installer trước khi push.
- **i18n rollout:** Update 14 locale files trong cùng 1 commit (atomic). Crowdin/POEditor không dùng — manual edit.

---

## 8. Open questions

- **Q1:** Có nên dùng symlink thay vì copy `CHANGELOG.md`? → **Decision: copy.** Windows admin privilege issue với symlink, không portable. Prebuild script đảm bảo sync.
- **Q2:** Có nên cache parse result để tránh parse mỗi launch? → **Decision: không.** CHANGELOG.md chỉ ~5KB, parse < 1ms. Không worth cache layer.
- **Q3:** Modal có nên có checkbox "Don't show again for this version"? → **Decision: không thêm.** localStorage đã track lastSeenVersion, dismiss = "don't show again for current". User re-trigger bất cứ lúc nào qua About.
- **Q4:** `minor_fixes_only` copy có cần localized không? → **Decision: có, i18n key `whatsnew.minor_fixes_only`.** Mỗi locale dịch "Bug fixes and small improvements" tự nhiên.

---

## 9. Out of scope (later)

- Localize commit messages (CHANGELOG.md giữ English).
- Cumulative highlights qua nhiều versions.
- Markdown rendering (bold, links, code blocks) trong modal — chỉ plain text bullets.
- Notification ngoài app (system tray).
- Persist "read receipts" ở backend / cloud.
- Auto-mark-as-read khi user đã xem GitHub release page.
- Rich media (screenshots, GIFs) trong highlights.
- Animated transitions khi modal mở/đóng (giữ current fade-in).