# Windows Tray Panel Auto-fit Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Windows tray panel width auto-fit label content (min 200px, max 480px), removing ellipsis on labels while keeping macOS and Linux layouts unchanged.

**Architecture:** Two-file change. CSS makes the panel's content container shrink-wrap via `inline-flex` so the existing `ResizeObserver` on the root reads the natural content width. Rust widens `max_w` clamp from 400 to 480 so longer locales fit. `TrayPanel.tsx` needs no change — its resize plumbing already drives off `ResizeObserver.contentRect.width`.

**Tech Stack:** Tauri 2 (Rust + WebView), React 18, TypeScript, Tailwind + raw CSS, vitest.

**Reference spec:** `docs/superpowers/specs/2026-07-08-windows-tray-panel-autofit-width-design.md`

---

## File Structure

**Modify (2 files):**

| File | Responsibility for this change |
|------|--------------------------------|
| `src/index.css` | Add `body[data-platform="win"]` rule: `.tray-panel-flex` becomes `inline-flex` with `width: auto`; `.tray-row-label` drops `overflow: hidden` and `text-overflow: ellipsis`. |
| `src-tauri/src/tray.rs` | Change clamp `max_w` from `400u32` to `480u32` in `resize_panel`. |

**No new files.** No new dependencies. No Rust unit tests (existing clamp logic changes by a magic number; visual verification is the source of truth).

---

## Task 1: Add Windows shrink-wrap CSS

**Files:**
- Modify: `src/index.css:667-672` (insert into the existing `body[data-platform="win"] .tray-panel-root` block area, right after the existing win block ends at the `--section--` divider line 664)

- [ ] **Step 1: Locate the existing Windows rule block**

Open `src/index.css`. The `body[data-platform="win"] .tray-panel-root` rule ends at line 672. The next major block (`macOS` panel rules) starts at line 694 with a comment divider. We add our rules right after line 672 (before the macOS section comment divider).

- [ ] **Step 2: Add the new Windows CSS block**

Insert the following block immediately after the closing brace of `body[data-platform="win"] .tray-panel-root` (line 672), and before the comment `/* --------------------------------------------------------------------- * macOS — NSMenu/NSPopover geometry.` (line 694):

```css
/* Windows: shrink-wrap tray panel to label content.
 * The base `.tray-panel-flex { width: 100% }` makes the panel fill the
 * window (220px on Windows). Switching to `inline-flex` lets the panel
 * size to its longest label so a row like
 * "Auto-detect scroll direction" renders without ellipsis. The
 * `ResizeObserver` in TrayPanel.tsx reports the natural width to
 * `resize_tray_panel`, which clamps to [200, 480] (Rust side).
 *
 * macOS and Linux keep their fixed 264px / 268px widths (different
 * selectors, not affected here).
 */
body[data-platform="win"] .tray-panel-flex {
  display: inline-flex;
  width: auto;
}
body[data-platform="win"] .tray-row-label {
  overflow: visible;
  text-overflow: clip;
}
```

Verification — read back the new lines with `Read src/index.css:673-692` (or open the file and scroll to the `body[data-platform="win"]` section). Both `inline-flex` and `width: auto` must be present on `.tray-panel-flex`. The `white-space: nowrap` rule on `.tray-row-label` (line 647-651) is intentionally untouched so labels stay on one line.

- [ ] **Step 3: Verify no other platform blocks leak**

Run in `D:/SmoothScroll`:

```bash
grep -n "tray-panel-flex" src/index.css
```

Expected output:
```
508:.tray-panel-flex {
512:  width: 100%;
514:}
... (new Windows block lines exactly once) ...
```

Also confirm `body[data-platform="mac"]` and `body[data-platform="linux"]` blocks for `.tray-panel-flex` are NOT present (those platforms must keep `flex` + `width: 100%` from the base rule):

```bash
grep -nE 'body\[data-platform="(mac|linux)"\] \.tray-panel-flex' src/index.css
```

Expected: no matches.

- [ ] **Step 4: Type-check the frontend**

Run in `D:/SmoothScroll`:

```bash
pnpm exec tsc --noEmit
```

Expected: exit code 0, no errors. CSS edits don't touch TS so this is a smoke test to confirm we didn't disturb other types.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "fix(tray): auto-fit Windows tray panel width to label content

Make .tray-panel-flex shrink-wrap via inline-flex on Windows so the
panel sizes to its longest label rather than fixed 220px. Drops
ellipsis on .tray-row-label. macOS (264px) and Linux (268px) unchanged."
```

---

## Task 2: Widen Rust max_w clamp from 400 to 480

**Files:**
- Modify: `src-tauri/src/tray.rs:189-191` (function `pub fn resize_panel`)

- [ ] **Step 1: Locate the clamp**

Open `src-tauri/src/tray.rs`. Function `resize_panel` at line 157 contains the clamp at lines 189-191:

```rust
let min_w = 200u32;
let max_w = 400u32;
let clamped_width = width.clamp(min_w, max_w);
```

- [ ] **Step 2: Change max_w from 400 to 480**

Use `StrReplace` to change exactly:

```rust
    let max_w = 400u32;
```

to:

```rust
    let max_w = 480u32;
```

Verify the change with `Read src-tauri/src/tray.rs:189-191`:

```rust
    let min_w = 200u32;
    let max_w = 480u32;
    let clamped_width = width.clamp(min_w, max_w);
```

- [ ] **Step 3: Confirm no other clamp site exists**

Run in `D:/SmoothScroll`:

```bash
grep -nE 'let max_w\s*=' src-tauri/src/tray.rs
```

Expected: exactly one match, line 190, value `480u32`.

Also confirm `min_w` and `min_h`/`max_h` blocks haven't changed:

```bash
grep -nE 'let (min_w|max_w|min_h|max_h)\s*=' src-tauri/src/tray.rs
```

Expected:
```
178:    let min_h = 120u32;
189:    let min_w = 200u32;
190:    let max_w = 480u32;
```

(line numbers above shown for verification only — actual numbers should be 189 and 190 after the edit)

`max_h` is computed earlier (around line 175) from the work area, not a constant, so it won't show in the grep — that's expected.

- [ ] **Step 4: Cargo check**

Run in `D:/SmoothScroll/src-tauri`:

```bash
cargo check
```

Expected: `Finished ... profile [unoptimized + debuginfo] target(s) in ...s`, exit code 0. No new warnings introduced.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "fix(tray): allow Windows tray panel to grow to 480px wide

Bumps max_w clamp in resize_panel from 400 to 480. min_w=200 stays.
Lets locales with longer labels (e.g. German Scrollrichtung
automatisch erkennen) fit without bumping again later. Rust
clamp guarantees no panic if frontend reports >480 (e.g. 4K scale)."
```

---

## Task 3: Local Windows build verification

Per workspace rule `build-locally-before-push`: trigger `release.yml` only after a working local exe exists. This task produces the artifact Honey tests against.

**Files:** None modified.

- [ ] **Step 1: Pre-flight: ensure wasm bundle is present**

Run in `D:/SmoothScroll`:

```bash
test -f src/lib/engine-wasm/smoothscroll_wasm.js && echo "wasm present" || echo "wasm MISSING — run: npm run build:wasm"
```

If missing, run:

```bash
npm run build:wasm
```

Expected: `wasm present` printed (script is a no-op if already built).

- [ ] **Step 2: Run tauri build**

Run in `D:/SmoothScroll/src-tauri`:

```bash
npx tauri build
```

Expected: ends with something like:

```
Finished `release` profile [optimized] target(s) in Xm Ys
     Bundling SmoothScroll_1.14.1_x64-setup.exe
    Bundling SmoothScroll_1.14.1_x64_en-US.msi
```

Build takes 5–15 minutes the first time (warm cache is faster). Don't background-poll — the tool runs blocking.

- [ ] **Step 3: Verify installer + msi artifacts exist**

Run in `D:/SmoothScroll`:

```bash
ls -la src-tauri/target/release/bundle/nsis/*.exe
ls -la src-tauri/target/release/bundle/msi/*.msi
```

Expected: at least one `.exe` and one `.msi` file matching version `1.14.1` (or higher if `version` bumped independently). Confirm the path matches what `release.yml` would produce so we know CI will work.

- [ ] **Step 4: Hand artifact to Honey for manual test**

Report to user:

- Path to NSIS installer: `src-tauri/target/release/bundle/nsis/SmoothScroll_1.14.1_x64-setup.exe`
- Path to MSI: `src-tauri/target/release/bundle/msi/SmoothScroll_1.14.1_x64_en-US.msi`
- Suggested manual tests (per spec Acceptance Criteria):
  - AC-1/AC-2: right-click tray, observe panel width hugs content; verify long label renders without ellipsis.
  - AC-5: paste a 200-char dummy label into a `MenuItem` in dev; rebuild; panel clamps at 480px.
  - AC-6: no first-frame flicker on panel open.

DO NOT push to `master` until Honey confirms the exe works on a real Windows machine.

---

## Done criteria

- [x] Task 1 committed (CSS shrink-wrap)
- [x] Task 2 committed (Rust clamp widened)
- [x] Task 3: local build green, exe + msi artifacts exist
- [x] Honey confirms Windows tray panel auto-fits and shows no ellipsis on long labels
- [x] macOS panel still 264px (no regression — only `body[data-platform="win"]` block was touched)
- [x] Linux panel still 268px (no regression — same reason)
- [x] `pnpm exec tsc --noEmit` and `cargo check` both pass with zero new warnings

Push to `master` happens only after explicit Honey confirmation per the `build-locally-before-push` rule.
