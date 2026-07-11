# Bug/Issue Fix Program — Meta Spec

> Date: 2026-07-12. Source of truth: `docs/BUG-REPORT.md`.
> Goal: fix all 16 issues (defects + missing-features) across 5 regions, via plan→implement cycles.

## 1. Goal

Resolve the 16 issues enumerated in `docs/BUG-REPORT.md`:
- **Defects**: code that is wrong (verified or reported) — fix directly with tests.
- **Missing-features**: stubs / incomplete platform support — capture requirement + acceptance criteria here; detailed design deferred to separate plan.

No new features beyond the fix scope.

## 2. Principles (apply to every sub-spec)

1. **Tests mandatory** (80% coverage rule): every defect fix ships with a test — Rust `cargo test`, TS `vitest`/`playwright`. Missing-features get ≥1 test verifying acceptance criteria.
2. **Strict flow**: every change (even verified 1-liners) goes through `writing-plans` → implement. No direct edits.
3. **Verify before claim**: VERIFIED defects fix per already-read source; REPORTED defects must be re-verified in source before fixing (subagent reports may be wrong).
4. **YAGNI**: no out-of-scope refactor; only remove dead code directly in scope (C1/C2/C3).
5. **Missing-feature = criteria-only** here: define requirement + acceptance criteria; detailed design in a later plan.

## 3. Sub-spec Map (16 issues → 5 sub-specs)

| Sub-spec | File | Issues | Type | Priority |
|----------|------|--------|------|----------|
| S1 | `2026-07-12-macos-hotkey-fix-design.md` | A1 (F12 keycode), A2 (keycode field 7→9) | Defect | 🔴 High |
| S2 | `2026-07-12-macos-scroll-fix-design.md` | A3 (double-scroll swallow), A4 (stubs) | Defect + criteria | 🔴 High |
| S3 | `2026-07-12-linux-fix-design.md` | B1 (X11 double), B2 (Wayland hotkey), B3/B4 (stubs) | Criteria + 1 defect | 🟠 High/Med |
| S4 | `2026-07-12-ui-landing-cleanup-design.md` | C1/C2 (dead code), C3 (orphan), C4 (naming), D1 (E2E gap) | Cleanup + 1 criteria | 🟢 Low/Med |
| S5 | `2026-07-12-tauri-ipc-fix-design.md` | E1 (socket wire), E2 (dup import), F1 (Swift↔Rust mismatch) | Verify + 1 defect | 🟠 High |

## 4. Sub-spec Template

Each sub-spec follows:
```
## 1. Context — issue ID, file, verified/reported
## 2. Current Behavior
## 3. Desired Behavior
## 4. Acceptance Criteria — measurable checklist
## 5. Test Plan — concrete tests (cargo test / vitest / playwright)
## 6. Implementation Notes — direction, not full code
## 7. Risks / Out-of-scope
```
Acceptance criteria: defect = "[wrong behavior] gone; [test X] passes". Missing-feature = "[capability Y] works on [platform Z]; acceptance = [test/manual]".

## 5. Execution Order & Dependencies

```
1. S5 (tauri-ipc-fix)   — F1 verify Swift↔Rust FIRST; S2 macOS scroll depends on macOS engine integration
2. S1 (macos-hotkey-fix) — independent, quick win
3. S2 (macos-scroll-fix) — A3 critical, after S5 confirms macOS engine
4. S3 (linux-fix)        — independent of macOS
5. S4 (ui-landing-cleanup) — independent, low risk, last
```
Gate between sub-specs: run `cargo test --workspace` + `pnpm test` green before proceeding.

## 6. Out-of-scope

- New platform support beyond existing (no new OS).
- UX redesign of settings UI.
- Changing the engine smoothing algorithm (only A3 correctness, not tuning).
- Release/version bumps (handled separately).
