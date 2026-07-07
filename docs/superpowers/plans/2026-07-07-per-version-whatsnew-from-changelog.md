Per-version "What's new" highlights auto-pulled from CHANGELOG.md — Implementation Plan (revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `WhatsNewModal` để tự động hiển thị highlights của đúng version mà user vừa update lên, lấy data từ `CHANGELOG.md` đã được auto-generate bởi `scripts/version-bump.mjs`. Thêm nút "Show release notes" trong Settings > About để manual trigger.

**Architecture:** Parser pure function (`src/lib/changelogParser.ts`) đọc bundled `CHANGELOG.md` (via Vite `?raw` import), extract entry khớp với current version. `WhatsNewModal` refactor dùng parser, render sections (Added/Fixed/Performance/Changed) + 2-nút footer (View full changelog mở browser GitHub release URL + Got it dismiss). AboutSection thêm nút dispatch custom event `whatsnew:open`.

**Tech Stack:** React 18, TypeScript, Vitest, Vite (`?raw` import), `@tauri-apps/plugin-shell` (open URL), `react-i18next` (14 locales).

---

## File Structure

**Files created:**
- `src/lib/changelogParser.ts` — Pure parser function (~100 LOC).
- `src/lib/changelogParser.test.ts` — Vitest tests (~180 LOC).
- `src/lib/CHANGELOG.md` — Copy của root `CHANGELOG.md` (git-tracked, sync qua prebuild script).
- `scripts/sync-changelog.mjs` — Tiny copy script (~10 LOC).

**Files modified:**
- `src/components/WhatsNewModal.tsx` — Refactor to use parser + render sections + custom event.
- `src/components/settings/AboutSection.tsx` — Thêm "Show release notes" button (sau dòng 110, trong updates card).
- `src/i18n/locales/*.json` (×14) — Thêm 6 keys mới + xóa 5 keys cũ (`highlights.0_2_0.*`).
- `package.json` — Thêm `"prebuild": "node scripts/sync-changelog.mjs"`.

**No backend / Rust / build pipeline changes.** No new dependencies.

---

## Task 1: Write parser with TDD

**Files:**
- Create: `src/lib/changelogParser.ts`
- Create: `src/lib/changelogParser.test.ts`

- [x] **Step 1: Write failing tests**
- [x] **Step 2: Run tests to verify they fail**
- [x] **Step 3: Implement parser**
- [x] **Step 4: Run tests to verify they pass** — 9/9 PASS, 61/61 total
- [x] **Step 5: Commit** — `726236c feat(whatsnew): add pure markdown changelog parser with tests`

---

## Task 2: Create sync script + wire prebuild

**Files:**
- Create: `scripts/sync-changelog.mjs`
- Modify: `package.json` (add prebuild script)

- [ ] **Step 1: Create sync script**

Create `scripts/sync-changelog.mjs`:

```javascript
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const SRC = resolve(projectRoot, "CHANGELOG.md");
const DEST = resolve(projectRoot, "src/lib/CHANGELOG.md");

if (!existsSync(SRC)) {
  console.error(`[sync-changelog] Source not found: ${SRC}`);
  process.exit(1);
}

copyFileSync(SRC, DEST);
console.log(`[sync-changelog] Copied CHANGELOG.md → ${DEST}`);
```

- [ ] **Step 2: Test script manually**

Run: `node scripts/sync-changelog.mjs`
Expected: `[sync-changelog] Copied CHANGELOG.md → d:\SmoothScroll\src\lib\CHANGELOG.md`

Verify: `Test-Path d:\SmoothScroll\src\lib\CHANGELOG.md` returns True.

- [ ] **Step 3: Verify copy is gitignored or not?**

Check `.gitignore`:

Run: `grep -n "CHANGELOG.md" .gitignore`
Expected: no output (file is NOT ignored — we want to track it).

- [ ] **Step 4: Add prebuild script to package.json**

Read current `package.json` scripts section (lines 6-15). Change:

```json
"build": "tsc && vite build",
```

To:

```json
"prebuild": "node scripts/sync-changelog.mjs",
"build": "tsc && vite build",
```

Also add predev for dev consistency:

```json
"predev": "node scripts/sync-changelog.mjs",
"dev": "vite",
```

Use `StrReplace` to apply these 2 changes.

- [ ] **Step 5: Run prebuild manually to verify**

Run: `pnpm run prebuild`
Expected: Sync script output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-changelog.mjs package.json src/lib/CHANGELOG.md
git commit -m "build: add prebuild script to sync CHANGELOG.md for Vite raw import"
```

---

## Task 3: Refactor WhatsNewModal to use parser

**Files:**
- Modify: `src/components/WhatsNewModal.tsx` (entire file replacement)

- [ ] **Step 1: Replace file with new implementation**

Read current `src/components/WhatsNewModal.tsx`. Replace entire content with:

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-shell";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";
import { parseChangelog, type ChangelogEntry } from "@/lib/changelogParser";
import rawChangelog from "@/lib/CHANGELOG.md?raw";

const STORAGE_KEY = "ss.whatsnew.lastSeenVersion";
const RELEASES_URL_BASE = "https://github.com/quangtruong2003/SmoothScroll/releases/tag/";

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualTrigger, setManualTrigger] = useState(false);

  // Listen for manual trigger from AboutSection
  useEffect(() => {
    const handler = () => setManualTrigger(true);
    window.addEventListener("whatsnew:open", handler);
    return () => window.removeEventListener("whatsnew:open", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await tauri.appVersion().catch(() => null);
      if (!v || cancelled) return;
      setVersion(v);
      const last = localStorage.getItem(STORAGE_KEY);
      const isNewVersion = last == null || compareVersions(v, last) > 0;
      if (isNewVersion || manualTrigger) {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manualTrigger]);

  const dismiss = () => {
    if (version && !manualTrigger) {
      try {
        localStorage.setItem(STORAGE_KEY, version);
      } catch {
        // localStorage disabled — silent fail
      }
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
    return null;
  }

  if (!entry) return null;

  const totalItems = entry.sections.reduce((sum, s) => sum + s.items.length, 0);

  const onViewFullChangelog = () => {
    const tagVersion = version.split(/[-+]/)[0];
    void open(`${RELEASES_URL_BASE}v${tagVersion}`).catch((e) => {
      console.warn("[WhatsNew] failed to open changelog URL:", e);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-background/80 backdrop-blur"
    >
      <div className="w-[520px] max-w-[92vw] rounded-xl border border-border bg-background p-6 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="whatsnew-title" className="text-base font-semibold">
                {t("whatsnew.title", "What's new")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("whatsnew.version_label", { version })}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("whatsnew.dismiss")}
            onClick={dismiss}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("whatsnew.tagline")}
        </p>

        {totalItems === 0 ? (
          <p className="mb-5 text-sm text-muted-foreground">
            {t("whatsnew.minor_fixes_only")}
          </p>
        ) : (
          <div className="mb-5 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {entry.sections.map((section) => (
              <section key={section.kind}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            onClick={onViewFullChangelog}
            className="text-sm text-primary hover:underline"
          >
            {t("whatsnew.view_changelog")} →
          </button>
          <Button onClick={dismiss}>{t("whatsnew.dismiss")}</Button>
        </div>
      </div>
    </div>
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Lint check**

Run: `pnpm run lint`
Expected: no new warnings/errors. If unused-vars in old `CHANGELOG` const, OK (file was rewritten).

- [ ] **Step 4: Commit**

```bash
git add src/components/WhatsNewModal.tsx
git commit -m "feat(whatsnew): auto-pull highlights from bundled CHANGELOG.md"
```

---

## Task 4: Add manual trigger button in AboutSection

**Files:**
- Modify: `src/components/settings/AboutSection.tsx` (add button + dispatch)

- [ ] **Step 1: Add button after updates section**

Read current `AboutSection.tsx` line 100-159 (the updates `CardContent` block). After the `flex flex-col gap-2 border-t pt-3` div (line 100), insert:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => window.dispatchEvent(new CustomEvent("whatsnew:open"))}
>
  {t("about.show_release_notes")}
</Button>
```

Use `StrReplace` — find the unique closing `</div>` of the updates block (before the `open_logs` button at line 160), insert new button between them.

The unique anchor:

```tsx
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => tauri.openLogDir()}>
```

becomes:

```tsx
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent("whatsnew:open"))}
        >
          {t("about.show_release_notes")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => tauri.openLogDir()}>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/AboutSection.tsx
git commit -m "feat(about): add 'Show release notes' button"
```

---

## Task 5: Update i18n locales — EN + VI

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`

- [ ] **Step 1: Update en.json**

Read `src/i18n/locales/en.json` lines 81-96 (`whatsnew` block) and around line 311 (`about` block — confirm location with grep).

Add keys to `whatsnew` block:

```json
"section_added": "Added",
"section_fixed": "Fixed",
"section_performance": "Performance",
"section_changed": "Changed",
"minor_fixes_only": "Some bug fixes and small improvements.",
```

Add key to `about` block:

```json
"show_release_notes": "Show release notes",
```

Remove entire `highlights` block from `whatsnew`:

Delete these lines (the `"highlights": { ... }` object including `0_2_0` keys).

Verify final shape with: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))"` exits 0.

- [ ] **Step 2: Update vi.json**

Same pattern with Vietnamese translations:

```json
"section_added": "Đã thêm",
"section_fixed": "Đã sửa",
"section_performance": "Hiệu năng",
"section_changed": "Thay đổi",
"minor_fixes_only": "Một số sửa lỗi và cải thiện nhỏ.",
```

```json
"show_release_notes": "Xem ghi chú phát hành",
```

Remove `highlights.0_2_0` block.

Verify with JSON parse.

- [ ] **Step 3: Commit EN + VI**

```bash
git add src/i18n/locales/en.json src/i18n/locales/vi.json
git commit -m "i18n(en,vi): add whatsnew section labels + about.show_release_notes; drop stale 0_2_0 highlights"
```

---

## Task 6: Update remaining 12 i18n locales

**Files:**
- Modify: `src/i18n/locales/{de,fr,es,it,ja,ko,zh,ru,id,pt-BR,tr,hi}.json` (×12)

- [ ] **Step 1: For each locale, add same keys + remove old block**

For each of the 12 locale files, do these 2 edits:

1. Inside `whatsnew` object, add (after `view_changelog`):
   ```json
   "section_added": "<Localized 'Added'>",
   "section_fixed": "<Localized 'Fixed'>",
   "section_performance": "<Localized 'Performance'>",
   "section_changed": "<Localized 'Changed'>",
   "minor_fixes_only": "<Localized 'Some bug fixes and small improvements.'>",
   ```

2. Inside `about` object, add (after `restart_now`):
   ```json
   "show_release_notes": "<Localized 'Show release notes'>",
   ```

3. Remove entire `highlights` block from `whatsnew`.

**Reference translations** (use exact text below):

| Locale | section_added | section_fixed | section_performance | section_changed | minor_fixes_only | show_release_notes |
|--------|---------------|---------------|---------------------|-----------------|------------------|---------------------|
| de     | Hinzugefügt   | Behoben       | Leistung            | Geändert        | Einige Fehlerbehebungen und kleine Verbesserungen. | Versionshinweise anzeigen |
| fr     | Ajouté        | Corrigé       | Performance         | Modifié         | Quelques corrections de bugs et petites améliorations. | Afficher les notes de version |
| es     | Añadido       | Corregido     | Rendimiento         | Cambiado        | Algunas correcciones de errores y pequeñas mejoras. | Mostrar notas de la versión |
| it     | Aggiunto      | Corretto      | Prestazioni         | Modificato      | Alcune correzioni di bug e piccoli miglioramenti. | Mostra note di rilascio |
| ja     | 追加           | 修正           | パフォーマンス       | 変更            | いくつかのバグ修正と小さな改善。 | リリースノートを表示 |
| ko     | 추가          | 수정           | 성능                 | 변경            | 일부 버그 수정 및 소소한 개선. | 릴리스 노트 표시 |
| zh     | 新增           | 修复           | 性能                 | 变更            | 一些错误修复和小幅改进。 | 查看发行说明 |
| ru     | Добавлено     | Исправлено    | Производительность  | Изменено        | Несколько исправлений и небольших улучшений. | Показать примечания к выпуску |
| id     | Ditambahkan   | Diperbaiki    | Performa            | Diubah          | Beberapa perbaikan bug dan peningkatan kecil. | Lihat catatan rilis |
| pt-BR  | Adicionado    | Corrigido     | Desempenho          | Alterado        | Algumas correções de bugs e pequenas melhorias. | Mostrar notas de versão |
| tr     | Eklendi       | Düzeltildi    | Performans          | Değiştirildi    | Bazı hata düzeltmeleri ve küçük iyileştirmeler. | Sürüm notlarını göster |
| hi     | जोड़ा गया     | ठीक किया गया  | प्रदर्शन            | बदला गया        | कुछ बग फिक्स और छोटे सुधार। | रिलीज़ नोट्स दिखाएँ |

For each file, after editing, verify JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/<locale>.json')); console.log('OK')"
```

Replace `<locale>` with actual filename.

- [ ] **Step 2: Commit all 12 locales**

```bash
git add src/i18n/locales/de.json src/i18n/locales/fr.json src/i18n/locales/es.json src/i18n/locales/it.json src/i18n/locales/ja.json src/i18n/locales/ko.json src/i18n/locales/zh.json src/i18n/locales/ru.json src/i18n/locales/id.json src/i18n/locales/pt-BR.json src/i18n/locales/tr.json src/i18n/locales/hi.json
git commit -m "i18n(12 locales): add whatsnew section labels + about.show_release_notes; drop stale 0_2_0 highlights"
```

---

## Task 7: Final verification — tests + manual smoke

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (parser tests + existing tests). No regressions.

- [ ] **Step 2: Run linter**

Run: `pnpm run lint`
Expected: 0 warnings, 0 errors.

- [ ] **Step 3: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Run dev server smoke test**

Run: `pnpm run dev`
Expected: Vite starts, app loads. In DevTools:
1. Check Settings > About > "Show release notes" button visible
2. Click → modal opens with `1.11.0` highlights (or current version)
3. Modal shows sections (Added: 3 items, Fixed: 1 item) for 1.11.0
4. Click "Got it" → closes, no localStorage update (manual trigger)
5. Click again → opens
6. Click "View full changelog →" → browser opens GitHub release page

- [ ] **Step 5: Verify auto-show on version change**

In DevTools console:

```js
localStorage.setItem("ss.whatsnew.lastSeenVersion", "1.10.0");
```

Reload app. Modal should open with 1.11.0 highlights. Click "Got it" → check `localStorage.getItem("ss.whatsnew.lastSeenVersion") === "1.11.0"`.

- [ ] **Step 6: Build production**

Run: `pnpm run build`
Expected: prebuild runs first (syncs CHANGELOG), then tsc + vite build. Exit 0.

Verify bundle size increase: ~5-10KB acceptable.

- [ ] **Step 7: Commit any final tweaks if needed**

If smoke tests revealed issues, fix inline. Otherwise no commit.

---

## Task 8: Build local Tauri release (per build-locally-before-push rule)

- [ ] **Step 1: Build WASM if needed**

Run: `pnpm run build:wasm`
Expected: generates `src/lib/engine-wasm/`. Exit 0.

- [ ] **Step 2: Build Tauri release**

Run: `cd src-tauri && npx tauri build`
Expected: produces installer at `src-tauri/target/release/bundle/nsis/SmoothScroll_1.11.0_x64-setup.exe`.

- [ ] **Step 3: Hand off installer path to user**

Report:
- `src-tauri/target/release/bundle/nsis/SmoothScroll_1.11.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/SmoothScroll_1.11.0_x64_en-US.msi`

Wait for user confirmation before pushing to master.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Goal 1 (auto-pull from CHANGELOG.md) → Task 1, 3
- ✅ Goal 2 (correct version display) → Task 3 (parser exact match logic)
- ✅ Goal 3 (robust edge cases) → Task 1 (tests cover all edge cases), Task 3 (try/catch around parse)
- ✅ Goal 4 (manual trigger) → Task 4
- ✅ Goal 5 (cleanup i18n orphans) → Task 5, 6
- ✅ Goal 6 (no pipeline changes) → Tasks only touch src/ + scripts/sync-changelog.mjs + package.json prebuild

**Placeholder scan:** No TBDs. All code blocks concrete.

**Type consistency:** `ChangelogEntry`, `ChangelogSection` exported from `changelogParser.ts` (Task 1) — same shape imported in `WhatsNewModal.tsx` (Task 3). `STORAGE_KEY` constant same. `RELEASES_URL_BASE` defined once. Custom event name `"whatsnew:open"` consistent between Task 3 listener and Task 4 dispatch.

**Build/deploy safety:** All changes scoped, fallback chain in parser ensures modal never breaks the app. Rollback = revert 1-7 commits.

**i18n completeness:** 14 locales covered in Tasks 5-6 with explicit translation table.

**Status (2026-07-07):** Task 1 ✅ COMPLETE (commit 726236c, 9/9 tests pass). All 7 subsequent tasks still pending.
