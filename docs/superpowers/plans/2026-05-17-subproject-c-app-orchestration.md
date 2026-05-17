# Sub-project C — App.tsx Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại race condition trong boot sequence của `App.tsx`, ngăn flash của null screen và "Skip" button trong ForcedUpdateModal. UX outcome: cold-start mượt, không nhấp nháy, modal hiển thị đúng final state ngay từ đầu.

**Architecture:** Tách boot logic ra `bootMachine.ts` (pure reducer + state types). `App.tsx` dùng `useReducer(bootReducer, ...)`. Mỗi state có effect riêng kích hoạt I/O tương ứng. Trusted-device check chạy parallel với update check, render `ForcedUpdateModal` chỉ sau khi cả 2 resolve.

**Tech Stack:** React 18 (`useReducer`, `useEffect`), TypeScript discriminated unions, Vitest cho reducer test (pure function, dễ test).

**Spec reference:** `docs/superpowers/specs/2026-05-17-smoothscroll-ux-perf-overhaul-design.md` § 5 (Sub-project C).

---

## File Structure

**Files modified:**
- `src/App.tsx` — rewrite dùng useReducer

**Files created:**
- `src/lib/bootMachine.ts` — state machine (pure)
- `src/lib/bootMachine.test.ts` — unit tests (Vitest)
- `src/lib/useDelayedFlag.ts` — small helper hook cho splash 200ms

---

## Task 1: bootMachine state types + reducer

**Files:**
- Create: `src/lib/bootMachine.ts`

- [ ] **Step 1: Tạo file**

```typescript
import type { Update } from "@tauri-apps/plugin-updater";

/**
 * Boot state for the main window. Discriminated union of mutually exclusive
 * stages; each stage maps to exactly one render branch in `App.tsx`.
 *
 * Sequence (happy path on main window):
 *   init → checking-accessibility → checking-update → ready
 */
export type BootState =
  | { kind: "init" }
  | { kind: "tray-panel" }
  | { kind: "checking-accessibility" }
  | { kind: "needs-accessibility" }
  | { kind: "checking-update"; trusted: boolean | null }
  | {
      kind: "update-required";
      update: Update;
      currentVersion: string;
      trusted: boolean;
      trustedKnown: boolean;
    }
  | { kind: "ready" };

export type BootEvent =
  | { type: "WINDOW_DETECTED"; label: string }
  | { type: "ACCESSIBILITY_RESULT"; granted: boolean }
  | { type: "ACCESSIBILITY_GRANTED" }
  | { type: "TRUSTED_RESULT"; trusted: boolean }
  | {
      type: "UPDATE_AVAILABLE";
      update: Update;
      currentVersion: string;
    }
  | { type: "UPDATE_NONE" }
  | { type: "UPDATE_SKIPPED" };

export const initialBootState: BootState = { kind: "init" };

/**
 * Pure reducer — never performs I/O. Side effects live in `App.tsx` effects
 * keyed off `state.kind`. Unhandled events are no-ops (return current state).
 */
export function bootReducer(state: BootState, event: BootEvent): BootState {
  switch (event.type) {
    case "WINDOW_DETECTED":
      if (state.kind !== "init") return state;
      if (event.label === "tray-panel") return { kind: "tray-panel" };
      return { kind: "checking-accessibility" };

    case "ACCESSIBILITY_RESULT":
      if (state.kind !== "checking-accessibility") return state;
      return event.granted
        ? { kind: "checking-update", trusted: null }
        : { kind: "needs-accessibility" };

    case "ACCESSIBILITY_GRANTED":
      if (state.kind !== "needs-accessibility") return state;
      return { kind: "checking-update", trusted: null };

    case "TRUSTED_RESULT":
      if (state.kind === "checking-update") {
        return { kind: "checking-update", trusted: event.trusted };
      }
      if (state.kind === "update-required" && !state.trustedKnown) {
        return { ...state, trusted: event.trusted, trustedKnown: true };
      }
      return state;

    case "UPDATE_AVAILABLE":
      if (state.kind !== "checking-update") return state;
      return {
        kind: "update-required",
        update: event.update,
        currentVersion: event.currentVersion,
        trusted: state.trusted ?? false,
        trustedKnown: state.trusted !== null,
      };

    case "UPDATE_NONE":
      if (state.kind !== "checking-update") return state;
      return { kind: "ready" };

    case "UPDATE_SKIPPED":
      if (state.kind !== "update-required") return state;
      if (!state.trusted) return state;
      return { kind: "ready" };

    default:
      return state;
  }
}
```

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bootMachine.ts
git commit -m "feat(boot): add bootMachine reducer for App orchestration"
```

---

## Task 2: bootMachine unit tests

**Files:**
- Create: `src/lib/bootMachine.test.ts`
- Optionally create: `vitest.config.ts` (if Vitest not yet set up)

- [ ] **Step 1: Cài Vitest nếu chưa có**

```bash
npm install -D vitest jsdom
```

Tạo `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node", globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Thêm script vào `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Viết test cases**

```typescript
import { describe, it, expect } from "vitest";
import { bootReducer, initialBootState, type BootState } from "./bootMachine";
import type { Update } from "@tauri-apps/plugin-updater";

const fakeUpdate = { version: "1.2.3", body: "" } as unknown as Update;

describe("bootReducer", () => {
  it("init -> tray-panel when window is tray-panel", () => {
    expect(
      bootReducer(initialBootState, { type: "WINDOW_DETECTED", label: "tray-panel" }),
    ).toEqual({ kind: "tray-panel" });
  });

  it("init -> checking-accessibility when window is main", () => {
    expect(
      bootReducer(initialBootState, { type: "WINDOW_DETECTED", label: "main" }),
    ).toEqual({ kind: "checking-accessibility" });
  });

  it("checking-accessibility -> needs-accessibility on denied", () => {
    const s: BootState = { kind: "checking-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_RESULT", granted: false })).toEqual({
      kind: "needs-accessibility",
    });
  });

  it("checking-accessibility -> checking-update on granted", () => {
    const s: BootState = { kind: "checking-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_RESULT", granted: true })).toEqual({
      kind: "checking-update",
      trusted: null,
    });
  });

  it("needs-accessibility -> checking-update on grant event", () => {
    const s: BootState = { kind: "needs-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_GRANTED" })).toEqual({
      kind: "checking-update",
      trusted: null,
    });
  });

  it("checking-update stores trusted result", () => {
    const s: BootState = { kind: "checking-update", trusted: null };
    expect(bootReducer(s, { type: "TRUSTED_RESULT", trusted: true })).toEqual({
      kind: "checking-update",
      trusted: true,
    });
  });

  it("checking-update -> ready when no update", () => {
    const s: BootState = { kind: "checking-update", trusted: true };
    expect(bootReducer(s, { type: "UPDATE_NONE" })).toEqual({ kind: "ready" });
  });

  it("checking-update -> update-required with trusted known", () => {
    const s: BootState = { kind: "checking-update", trusted: true };
    const next = bootReducer(s, {
      type: "UPDATE_AVAILABLE",
      update: fakeUpdate,
      currentVersion: "1.0.0",
    });
    expect(next).toMatchObject({
      kind: "update-required",
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    });
  });

  it("update-required: trustedKnown=false when trusted not yet known", () => {
    const s: BootState = { kind: "checking-update", trusted: null };
    const next = bootReducer(s, {
      type: "UPDATE_AVAILABLE",
      update: fakeUpdate,
      currentVersion: "1.0.0",
    });
    expect(next).toMatchObject({
      kind: "update-required",
      trusted: false,
      trustedKnown: false,
    });
  });

  it("update-required: late TRUSTED_RESULT upgrades canSkip + trustedKnown", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: false,
      trustedKnown: false,
    };
    const next = bootReducer(s, { type: "TRUSTED_RESULT", trusted: true });
    expect(next).toMatchObject({
      kind: "update-required",
      trusted: true,
      trustedKnown: true,
    });
  });

  it("update-required with trustedKnown=true: late TRUSTED_RESULT ignored", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "TRUSTED_RESULT", trusted: false })).toBe(s);
  });

  it("update-required -> ready on skip when trusted", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "UPDATE_SKIPPED" })).toEqual({ kind: "ready" });
  });

  it("update-required: untrusted cannot skip", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: false,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "UPDATE_SKIPPED" })).toBe(s);
  });

  it("ignores out-of-order events (init: ACCESSIBILITY_RESULT)", () => {
    expect(
      bootReducer(initialBootState, { type: "ACCESSIBILITY_RESULT", granted: true }),
    ).toEqual(initialBootState);
  });

  it("ignores duplicate WINDOW_DETECTED", () => {
    const s: BootState = { kind: "tray-panel" };
    expect(bootReducer(s, { type: "WINDOW_DETECTED", label: "main" })).toEqual(s);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/bootMachine.test.ts`
Expected: 14 passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bootMachine.test.ts vitest.config.ts package.json package-lock.json
git commit -m "test(boot): unit tests for bootReducer"
```

---

## Task 3: useDelayedFlag helper

**Files:**
- Create: `src/lib/useDelayedFlag.ts`

- [ ] **Step 1: Tạo hook**

```typescript
import { useEffect, useState } from "react";

/**
 * Returns true after `delayMs` has elapsed since the hook mounted.
 * Useful to avoid flashing transient loading UI for fast operations.
 */
export function useDelayedFlag(delayMs: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return flag;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/useDelayedFlag.ts
git commit -m "feat: useDelayedFlag hook for non-flashing loading indicators"
```

---

## Task 4: Refactor App.tsx dùng bootMachine

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace toàn bộ App.tsx**

```tsx
import { useEffect, useReducer } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SettingsPage } from "./routes/Settings";
import { PermissionGate } from "./components/macos/PermissionGate";
import { TrayPanel } from "./components/TrayPanel";
import { ForcedUpdateModal } from "./components/ForcedUpdateModal";
import { tauri } from "./lib/tauri";
import { checkForUpdate } from "./lib/updater";
import { bootReducer, initialBootState } from "./lib/bootMachine";
import { useDelayedFlag } from "./lib/useDelayedFlag";

export default function App() {
  const [state, dispatch] = useReducer(bootReducer, initialBootState);
  const showSplash = useDelayedFlag(200);

  // 1) Detect window label once.
  useEffect(() => {
    const label = getCurrentWindow().label;
    dispatch({ type: "WINDOW_DETECTED", label });
  }, []);

  // 2) Accessibility check (only on main window, only when entering that state).
  useEffect(() => {
    if (state.kind !== "checking-accessibility") return;
    let cancelled = false;
    void tauri
      .accessibilityStatus()
      .then((granted) => {
        if (!cancelled) dispatch({ type: "ACCESSIBILITY_RESULT", granted });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "ACCESSIBILITY_RESULT", granted: true });
      });
    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  // 3) Update + trusted check fire in parallel when entering checking-update.
  useEffect(() => {
    if (state.kind !== "checking-update") return;
    let cancelled = false;

    void (async () => {
      const result = await checkForUpdate();
      if (cancelled) return;
      if (result.state === "available") {
        await tauri.showMainWindow().catch(() => {});
        dispatch({
          type: "UPDATE_AVAILABLE",
          update: result.update,
          currentVersion: result.currentVersion,
        });
      } else {
        dispatch({ type: "UPDATE_NONE" });
      }
    })();

    void tauri
      .isTrustedDevice()
      .then((trusted) => {
        if (!cancelled) dispatch({ type: "TRUSTED_RESULT", trusted });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "TRUSTED_RESULT", trusted: false });
      });

    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  // 4) Render
  switch (state.kind) {
    case "init":
    case "checking-accessibility":
    case "checking-update":
      return showSplash ? <BootSplash /> : null;

    case "tray-panel":
      return <TrayPanel />;

    case "needs-accessibility":
      return (
        <PermissionGate
          onGranted={() => dispatch({ type: "ACCESSIBILITY_GRANTED" })}
        />
      );

    case "update-required":
      // Wait for trusted result before showing modal — avoids flicker on Skip button.
      if (!state.trustedKnown) {
        return showSplash ? <BootSplash /> : null;
      }
      return (
        <ForcedUpdateModal
          update={state.update}
          currentVersion={state.currentVersion}
          canSkip={state.trusted}
          onSkip={() => dispatch({ type: "UPDATE_SKIPPED" })}
        />
      );

    case "ready":
      return <SettingsPage />;
  }
}

function BootSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-screen items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-hidden
        />
        <p className="text-xs text-muted-foreground">SmoothScroll</p>
      </div>
    </div>
  );
}
```

**Note:** TypeScript exhaustiveness — `switch (state.kind)` cover tất cả `BootState` variants.

- [ ] **Step 2: TS check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): boot orchestration via reducer + delayed splash"
```

---

## Task 5: Manual UX smoke test

- [ ] **Step 1: Build dev**

Run: `npm run tauri dev`

- [ ] **Step 2: Test cold-start không flash**

1. Quit app hoàn toàn (tray → Quit).
2. Khởi động app từ Start menu / Spotlight.
3. ✅ pass nếu thấy: blank → (sau ≥ 200ms nếu chậm) splash spinner → SettingsPage. **Không** thấy:
   - Null → SettingsPage chớp ngược (flash).
   - PermissionGate chớp rồi biến mất (race với accessibilityStatus).

Lặp 10 lần. Pass nếu 10/10 ổn.

- [ ] **Step 3: Test ForcedUpdateModal không flicker Skip button**

Setup trên trusted device:

```powershell
$env:SMOOTHSCROLL_TRUSTED_HOSTS = "$env:COMPUTERNAME"
npm run tauri build
```

Chạy `target/release/smoothscroll-app.exe`. Khi update-required modal xuất hiện:
- ✅ pass nếu nút "Skip (trusted device)" hiển thị **ngay** từ frame đầu, không chớp ẩn → hiện.

Test ngược: build không có env (untrusted) → modal hiện không có Skip button. Cũng không flicker.

- [ ] **Step 4: Test tray-panel window không gọi accessibility/update**

1. Mở tray panel (right-click tray icon → mở panel).
2. Trong DevTools → Network tab.
3. ✅ pass nếu **không** thấy IPC `accessibility_status`, `is_trusted_device`. Update plugin cũng không fire.

- [ ] **Step 5: Test PermissionGate flow (macOS only — skip on Windows)**

1. Build trên macOS, thu hồi accessibility permission.
2. Mở app → `PermissionGate` hiện.
3. Grant accessibility → app nhận callback → `ACCESSIBILITY_GRANTED` dispatch → `checking-update` → `ready`.
4. ✅ pass nếu transition mượt, không flash.

- [ ] **Step 6: Test edge case — accessibility check throw**

Tạm sửa `src/App.tsx` Effect 2:

```typescript
.then(() => { throw new Error("test"); })
```

Restart dev. Expected: catch fallback dispatch `granted: true` → app render Settings (giữ behaviour cũ — fail-open). Khôi phục code sau test.

- [ ] **Step 7: Test exhaustiveness của switch**

Trong `App.tsx`, tạm thêm 1 variant mới vào `BootState` (e.g. `| { kind: "test" }`). TS phải báo lỗi missing case trong `switch`. Khôi phục sau verify.

- [ ] **Step 8: Production build check**

Run: `npm run tauri build`
Expected: build PASS.

- [ ] **Step 9: Final commit log review**

```bash
git log --oneline -10
```
Expected: 4-5 commit từ sub-project C.

---

## Task 6: Optional — visual splash polish

- [ ] **Step 1: Splash với logo**

Replace `BootSplash`:

```tsx
function BootSplash() {
  return (
    <div role="status" aria-live="polite" className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src="/icon.png" alt="" width={64} height={64} className="opacity-90" />
      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 bg-primary animate-[boot-progress_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
```

Thêm keyframe vào `src/index.css`:

```css
@keyframes boot-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
```

(Lưu ý: copy `src-tauri/icons/128x128@2x.png` vào `public/icon.png` để Vite serve.)

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx src/index.css public/icon.png
git commit -m "polish(boot): logo + indeterminate progress bar in splash"
```
