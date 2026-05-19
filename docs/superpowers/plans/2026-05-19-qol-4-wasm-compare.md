# QoL Plan 4 — Live A/B preview via WASM engine (Gap #2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile the engine to WebAssembly, expose a thin JS API, and add a side-by-side Compare mode in `TestSandboxSection` so users can feel current settings vs candidate settings without saving.

**Architecture:** `crates/core` gains a `wasm` feature that exports `WasmEngine` via `wasm-bindgen`. Disk-IO and `directories` are gated `#[cfg(not(target_arch = "wasm32"))]`. A wasm-pack build produces `pkg/`; a build script wires output into `src/lib/engine-wasm/`. React wraps it in `useWasmEngine()`; `<ScrollPreviewArea>` runs a RAF loop animating `scrollTop` from `engine.step(dt)`. `<ScrollComparePane>` renders two areas side-by-side with hover-gated wheel routing.

**Tech Stack:** Rust → wasm32-unknown-unknown via `wasm-bindgen` + `wasm-pack`, React, RAF.

**Spec:** `docs/superpowers/specs/2026-05-19-qol-pass-design.md` § Gap #2

**Depends on:** Plans 1 + 3 land cleanly in core (this plan reads `EffectiveSettings` shape including `instant_mode` and modifier flags). Order: ship Plan 1 and 3 first.

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `crates/core/Cargo.toml` | Add `wasm` feature + `wasm-bindgen` dep gated to wasm |
| Modify | `crates/core/src/lib.rs` | Gate `settings::settings_path/load/save` behind `#[cfg(not(target_arch = "wasm32"))]`; add `wasm` module |
| Create | `crates/core/src/wasm.rs` | `WasmEngine` wrapper |
| Create | `scripts/build-wasm.sh` and `scripts/build-wasm.ps1` | wasm-pack build |
| Modify | `package.json` | Add `build:wasm` script + dev convenience |
| Create | `src/lib/engine-wasm/index.ts` | Loader + reload helpers |
| Create | `src/components/preview/ScrollPreviewArea.tsx` | Single-pane RAF preview |
| Create | `src/components/preview/ScrollComparePane.tsx` | Two-pane Compare wrapper |
| Modify | `src/components/settings/TestSandboxSection.tsx` | Add Compare toggle |
| Modify | i18n locale files | "Compare", "Apply B", "Swap" |
| Modify | `vite.config.ts` | Allow loading WASM from `src/lib/engine-wasm/` |

---

## Task 1: Add `wasm` feature & gate disk IO in core

**Files:**
- Modify: `crates/core/Cargo.toml`
- Modify: `crates/core/src/lib.rs`
- Modify: `crates/core/src/settings.rs`

- [ ] **Step 1: Cargo features**

In `crates/core/Cargo.toml`:

```toml
[features]
default = []
wasm = ["dep:wasm-bindgen", "dep:js-sys"]

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
directories = { workspace = true }

[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm-bindgen = { version = "0.2", optional = true }
js-sys = { version = "0.3", optional = true }
```

(If `directories` is in `[dependencies]`, move to the cfg-gated block.)

- [ ] **Step 2: Gate disk IO in `settings.rs`**

Wrap `settings_path`, `load`, `try_load`, `save` and the `SettingsError::Io` / `Json` use with:

```rust
#[cfg(not(target_arch = "wasm32"))]
pub fn settings_path() -> Result<PathBuf, SettingsError> { ... }

#[cfg(not(target_arch = "wasm32"))]
pub fn load() -> AppSettings { ... }

#[cfg(not(target_arch = "wasm32"))]
fn try_load() -> Result<AppSettings, SettingsError> { ... }

#[cfg(not(target_arch = "wasm32"))]
pub fn save(settings: &AppSettings) -> Result<(), SettingsError> { ... }
```

The `AppSettings`, `EffectiveSettings`, `ScrollProfile`, `ThemeMode`, `ModifierPassthrough`, `RespectReduceMotion`, `is_valid_accelerator` items remain unconditional.

- [ ] **Step 3: Gate `directories` import**

```rust
#[cfg(not(target_arch = "wasm32"))]
use directories::ProjectDirs;
```

(Adjust to actual current usage.)

- [ ] **Step 4: Add `wasm` module export**

In `crates/core/src/lib.rs`:

```rust
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub mod wasm;
```

- [ ] **Step 5: Build check (native)**

```
cargo build -p smoothscroll_core
```

Expected: success, behaviour unchanged.

- [ ] **Step 6: Build check (wasm target without feature)**

```
rustup target add wasm32-unknown-unknown
cargo build -p smoothscroll_core --target wasm32-unknown-unknown
```

Expected: success.

- [ ] **Step 7: Commit**

```
git add crates/core/Cargo.toml crates/core/src/lib.rs crates/core/src/settings.rs
git commit -m "build(core): wasm feature + gate disk IO behind cfg"
```

---

## Task 2: `WasmEngine` wrapper

**Files:**
- Create: `crates/core/src/wasm.rs`

- [ ] **Step 1: Implement**

```rust
//! WASM-friendly engine wrapper. Mirrors the native API but takes settings
//! as JSON strings to avoid binding the full `EffectiveSettings` shape.

use crate::engine::{EngineOutput, SmoothScrollEngine};
use crate::input_source::InputSource;
use crate::settings::{AppSettings, EffectiveSettings};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmEngine {
    engine: SmoothScrollEngine,
    eff: EffectiveSettings,
}

#[wasm_bindgen]
impl WasmEngine {
    /// Build from a JSON-serialized AppSettings. The frontend can pass the
    /// same settings shape it already has.
    #[wasm_bindgen(constructor)]
    pub fn new(json_settings: &str) -> Result<WasmEngine, JsError> {
        let s: AppSettings = serde_json::from_str(json_settings)
            .map_err(|e| JsError::new(&format!("settings parse: {e}")))?;
        let eff = EffectiveSettings::from_settings(&s);
        Ok(WasmEngine { engine: SmoothScrollEngine::new(), eff })
    }

    /// Hot-swap settings without rebuilding the engine state.
    pub fn update_settings(&mut self, json_settings: &str) -> Result<(), JsError> {
        let s: AppSettings = serde_json::from_str(json_settings)
            .map_err(|e| JsError::new(&format!("settings parse: {e}")))?;
        self.eff = EffectiveSettings::from_settings(&s);
        Ok(())
    }

    /// Inject a wheel event. `now_ms` is a JS-supplied monotonic timestamp.
    pub fn on_wheel(&mut self, delta: i32, now_ms: f64) {
        self.engine.on_wheel_with_source(delta, now_ms as u64, InputSource::Wheel, &self.eff);
    }

    pub fn on_hwheel(&mut self, delta: i32, now_ms: f64) {
        self.engine.on_hwheel_with_source(delta, now_ms as u64, InputSource::Wheel, &self.eff);
    }

    /// Step the engine. Returns `[vertical, horizontal]` pulses.
    pub fn step(&mut self, dt_ms: f64) -> Box<[i32]> {
        let EngineOutput { vertical, horizontal } = self.engine.step(dt_ms, &self.eff);
        Box::new([vertical, horizontal])
    }

    pub fn has_pending_work(&self) -> bool {
        self.engine.has_pending_work()
    }

    pub fn reset(&mut self) {
        self.engine.reset_axes();
    }
}
```

- [ ] **Step 2: Build wasm**

```
cargo build -p smoothscroll_core --target wasm32-unknown-unknown --features wasm
```

Expected: success.

- [ ] **Step 3: Commit**

```
git add crates/core/src/wasm.rs
git commit -m "feat(core): WasmEngine wasm-bindgen wrapper"
```

---

## Task 3: wasm-pack build script

**Files:**
- Create: `scripts/build-wasm.ps1` and `scripts/build-wasm.sh`
- Modify: `package.json`

- [ ] **Step 1: Install wasm-pack**

```
cargo install wasm-pack
```

- [ ] **Step 2: Write `scripts/build-wasm.ps1`**

```powershell
# Build the WASM engine and copy output into src/lib/engine-wasm
$ErrorActionPreference = "Stop"
$out = "src/lib/engine-wasm"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
wasm-pack build crates/core --target web --out-dir ../../$out --features wasm
```

`scripts/build-wasm.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
out="src/lib/engine-wasm"
rm -rf "$out"
wasm-pack build crates/core --target web --out-dir ../../"$out" --features wasm
```

`chmod +x scripts/build-wasm.sh` if on Unix.

- [ ] **Step 3: Add `package.json` script**

```json
"scripts": {
  "build:wasm": "node -e \"const{spawnSync}=require('child_process');const r=spawnSync(process.platform==='win32'?'powershell':'bash',[process.platform==='win32'?'-File':'',process.platform==='win32'?'scripts/build-wasm.ps1':'scripts/build-wasm.sh'].filter(Boolean),{stdio:'inherit'});process.exit(r.status||0)\"",
  "predev": "pnpm run build:wasm",
  "prebuild": "pnpm run build:wasm"
}
```

(Or simpler: two separate scripts and adjust developer docs to run `pnpm build:wasm` once after pulling.)

- [ ] **Step 4: Run build**

```
pnpm build:wasm
```

Expected: `src/lib/engine-wasm/` populated with `smoothscroll_core_bg.wasm`, `smoothscroll_core.js`, `smoothscroll_core.d.ts`, `package.json`.

- [ ] **Step 5: Add `.gitignore` entry**

```
src/lib/engine-wasm/
```

- [ ] **Step 6: Commit**

```
git add scripts/build-wasm.* package.json .gitignore
git commit -m "build: wasm-pack pipeline for engine"
```

---

## Task 4: Vite config to serve WASM

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Adjust if needed**

If imports of `?init` / `?url` from `engine-wasm` fail, ensure assets are inlined or served. Typical config:

```ts
import { defineConfig } from "vite";
export default defineConfig({
  // ... existing
  optimizeDeps: { exclude: ["@/lib/engine-wasm"] },
  server: { fs: { allow: [".", "src/lib/engine-wasm"] } },
});
```

In most Vite + Tauri projects, the wasm files just work. Only adjust if a build error occurs.

- [ ] **Step 2: Build sanity**

```
pnpm build
```

Expected: success.

- [ ] **Step 3: Commit if changed**

```
git add vite.config.ts
git commit -m "build(ui): vite config for engine-wasm assets"
```

---

## Task 5: Frontend `useWasmEngine` hook

**Files:**
- Create: `src/lib/engine-wasm/index.ts`

- [ ] **Step 1: Wrapper module**

`src/lib/engine-wasm/index.ts`:

```typescript
import init, { WasmEngine } from "./smoothscroll_core";
import wasmUrl from "./smoothscroll_core_bg.wasm?url";

let initialized: Promise<void> | null = null;

export async function ensureWasmReady(): Promise<void> {
  if (!initialized) initialized = init(wasmUrl).then(() => undefined);
  return initialized;
}

export async function createEngine(settingsJson: string): Promise<WasmEngine> {
  await ensureWasmReady();
  return new WasmEngine(settingsJson);
}

export type { WasmEngine };
```

- [ ] **Step 2: Hook**

`src/components/preview/useWasmEngine.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import { createEngine, type WasmEngine } from "@/lib/engine-wasm";
import type { AppSettings } from "@/lib/tauri";

export function useWasmEngine(settings: AppSettings | null): WasmEngine | null {
  const [engine, setEngine] = useState<WasmEngine | null>(null);
  const ref = useRef<WasmEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!settings) return;
    if (!ref.current) {
      createEngine(JSON.stringify(settings)).then((e) => {
        if (cancelled) return;
        ref.current = e;
        setEngine(e);
      });
    } else {
      ref.current.update_settings(JSON.stringify(settings));
    }
    return () => { cancelled = true; };
  }, [settings && JSON.stringify(settings)]);

  return engine;
}
```

- [ ] **Step 3: TS check**

```
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/lib/engine-wasm/index.ts src/components/preview/useWasmEngine.ts
git commit -m "feat(ui): useWasmEngine hook"
```

---

## Task 6: `<ScrollPreviewArea />`

**Files:**
- Create: `src/components/preview/ScrollPreviewArea.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useRef } from "react";
import type { WasmEngine } from "@/lib/engine-wasm";

interface Props {
  engine: WasmEngine | null;
  active: boolean; // only this pane receives wheel
  className?: string;
  children: React.ReactNode;
}

export function ScrollPreviewArea({ engine, active, className, children }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Wheel handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !engine) return;
    const onWheel = (e: WheelEvent) => {
      if (!active) return;
      e.preventDefault();
      const delta = -e.deltaY * 1.0; // browser delta is pixels — convert to engine notch units approx.
      // The engine treats input as wheel-notch units (WHEEL_DELTA). Browser deltaY ≈ 100 per notch.
      const wheelDelta = Math.round((delta / 100) * 120);
      if (wheelDelta !== 0) engine.on_wheel(wheelDelta, performance.now());
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [engine, active]);

  // RAF loop
  useEffect(() => {
    if (!engine) return;
    const loop = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const out = engine.step(dt);
      if (out[0] !== 0 && containerRef.current) {
        // Engine returns wheel pulses; convert back to pixels.
        const px = -(out[0] / 120) * 100;
        containerRef.current.scrollTop += px;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto rounded-md border border-border bg-background ${active ? "ring-2 ring-primary" : ""} ${className ?? ""}`}
      style={{ height: 240, scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  );
}
```

Note: the px↔notch conversion mirror is approximate; calibrate during smoke testing.

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add src/components/preview/ScrollPreviewArea.tsx
git commit -m "feat(ui): ScrollPreviewArea component"
```

---

## Task 7: `<ScrollComparePane />` + sample content

**Files:**
- Create: `src/components/preview/ScrollComparePane.tsx`
- Create: `src/components/preview/sampleContent.tsx`

- [ ] **Step 1: Sample content**

`src/components/preview/sampleContent.tsx`:

```tsx
export function SamplePreviewContent() {
  return (
    <div className="px-3 py-2 text-sm leading-relaxed">
      {Array.from({ length: 60 }).map((_, i) => (
        <p key={i} className="mb-3">
          {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Compare pane**

`src/components/preview/ScrollComparePane.tsx`:

```tsx
import { useState } from "react";
import type { AppSettings } from "@/lib/tauri";
import { useWasmEngine } from "./useWasmEngine";
import { ScrollPreviewArea } from "./ScrollPreviewArea";
import { SamplePreviewContent } from "./sampleContent";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface Props {
  settingsA: AppSettings;
  settingsB: AppSettings;
  onApplyB: () => void;
  onSwap: () => void;
}

export function ScrollComparePane({ settingsA, settingsB, onApplyB, onSwap }: Props) {
  const { t } = useTranslation();
  const engineA = useWasmEngine(settingsA);
  const engineB = useWasmEngine(settingsB);
  const [active, setActive] = useState<"A" | "B">("A");

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div onMouseEnter={() => setActive("A")}>
          <div className="mb-1 text-xs text-muted-foreground">{t("compare.a_label")}</div>
          <ScrollPreviewArea engine={engineA} active={active === "A"}>
            <SamplePreviewContent />
          </ScrollPreviewArea>
        </div>
        <div onMouseEnter={() => setActive("B")}>
          <div className="mb-1 text-xs text-muted-foreground">{t("compare.b_label")}</div>
          <ScrollPreviewArea engine={engineB} active={active === "B"}>
            <SamplePreviewContent />
          </ScrollPreviewArea>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onSwap}>{t("compare.swap")}</Button>
        <Button size="sm" onClick={onApplyB}>{t("compare.apply_b")}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add src/components/preview/
git commit -m "feat(ui): ScrollComparePane + sample content"
```

---

## Task 8: Wire Compare into `TestSandboxSection`

**Files:**
- Modify: `src/components/settings/TestSandboxSection.tsx`

- [ ] **Step 1: Read current sandbox**

Read the file to confirm its existing structure.

- [ ] **Step 2: Add Compare toggle + integration**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { ScrollComparePane } from "@/components/preview/ScrollComparePane";
import { Switch } from "@/components/ui/switch";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/lib/tauri";

export function TestSandboxSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings) as AppSettings | null;
  const reload = useSettingsStore((s) => s.load);

  const [compareOn, setCompareOn] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<AppSettings | null>(null);

  // When compare toggles on, capture the saved snapshot from disk.
  const enableCompare = async (v: boolean) => {
    setCompareOn(v);
    if (v) {
      const fromDisk = await invoke<AppSettings>("get_settings");
      setSavedSnapshot(fromDisk);
    } else {
      setSavedSnapshot(null);
    }
  };

  const onApplyB = async () => {
    if (!settings) return;
    await invoke("save_settings", { settings });
    await reload();
    setSavedSnapshot(settings);
  };

  const onSwap = () => {
    if (!savedSnapshot || !settings) return;
    // Apply A as the new draft, set B = previous draft.
    // Implement by patching settings in store with savedSnapshot.
    const previousDraft = settings;
    useSettingsStore.getState().setAll(savedSnapshot);
    setSavedSnapshot(previousDraft);
  };

  if (!settings) return null;

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("sandbox.title")}</h3>
        <label className="flex items-center gap-2 text-xs">
          <span>{t("compare.toggle")}</span>
          <Switch checked={compareOn} onCheckedChange={enableCompare} />
        </label>
      </header>

      {compareOn && savedSnapshot ? (
        <ScrollComparePane
          settingsA={savedSnapshot}
          settingsB={settings}
          onApplyB={onApplyB}
          onSwap={onSwap}
        />
      ) : (
        // Existing single-pane sandbox content (preserve original markup)
        <SinglePaneSandbox />
      )}
    </section>
  );
}

function SinglePaneSandbox() {
  // Move the existing TestSandboxSection body here so non-compare flow is unchanged.
  return null;
}
```

(Replace the `SinglePaneSandbox` placeholder with the actual existing content extracted from `TestSandboxSection`.)

- [ ] **Step 3: Add `setAll` to settings store**

In `src/stores/settingsStore.ts`, if `setAll(snapshot)` does not exist, add:

```typescript
setAll: (snapshot: AppSettings) => set({ settings: snapshot }),
```

- [ ] **Step 4: TS check & smoke**

```
pnpm tsc --noEmit
pnpm tauri dev
```

Open Settings → Scroll → toggle Compare. Should see two panes; hover each, scroll wheel, feel difference. "Apply B" persists current; "Swap" reverses.

- [ ] **Step 5: Commit**

```
git add src/components/settings/TestSandboxSection.tsx src/stores/settingsStore.ts
git commit -m "feat(ui): Compare mode in TestSandboxSection"
```

---

## Task 9: i18n keys

**Files:**
- Modify: English locale

- [ ] **Step 1: Add**

```json
"compare": {
  "toggle": "Compare",
  "a_label": "A — Saved",
  "b_label": "B — Editing",
  "swap": "Swap A ↔ B",
  "apply_b": "Apply B as new default"
}
```

- [ ] **Step 2: Commit**

```
git add src/i18n/...
git commit -m "feat(ui): compare i18n keys"
```

---

## Task 10: Cross-check: WASM engine output matches native

**Files:**
- Create: `crates/core/tests/wasm_parity.rs` (gated `#[cfg(target_arch = "wasm32")]`) — or, simpler, document the parity expectation since both call the same `engine.rs`.

The cleanest verification: a Node-side smoke test runs the WASM bundle on a fixed input sequence and a native test runs the same sequence; outputs match.

- [ ] **Step 1: Native fixture test**

In `crates/core/tests/engine_tests.rs`, add a deterministic fixture test:

```rust
#[test]
fn deterministic_fixture_output() {
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::input_source::InputSource;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    let mut total_v = 0i32;
    for tick in 0..100 {
        if tick % 10 == 0 {
            e.on_wheel_with_source(120, tick * 8, InputSource::Wheel, &eff);
        }
        let out = e.step(8.0, &eff);
        total_v += out.vertical;
    }
    // Pin a single representative number — update intentionally if engine changes.
    assert!(total_v != 0);
    assert!(total_v.abs() > 100);
}
```

- [ ] **Step 2: Manual WASM smoke**

In a one-off Node/browser console:

```js
import init, { WasmEngine } from "./src/lib/engine-wasm/smoothscroll_core.js";
await init();
const e = new WasmEngine(JSON.stringify(/* same default settings JSON */));
let total = 0;
for (let tick = 0; tick < 100; tick++) {
  if (tick % 10 === 0) e.on_wheel(120, tick * 8);
  total += e.step(8.0)[0];
}
console.log(total);
```

Compare with the native fixture's `total_v`. Within rounding (i32 cast), they should match.

- [ ] **Step 3: Commit**

```
git add crates/core/tests/engine_tests.rs
git commit -m "test(core): deterministic engine fixture for parity"
```

---

## Task 11: Final verification

- [ ] **Step 1: Tests + lints**

```
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
pnpm tsc --noEmit
```

- [ ] **Step 2: Manual smoke**

- Open Settings → Scroll → toggle Compare → 2 panes
- Adjust step_size_px → B becomes faster than A — feel difference side-by-side
- Apply B → both panes now identical
- Toggle Compare off → existing single-pane sandbox returns

- [ ] **Step 3: Commit if needed**

```
git status
```

Expected: clean.
