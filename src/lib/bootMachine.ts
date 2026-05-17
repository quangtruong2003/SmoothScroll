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
