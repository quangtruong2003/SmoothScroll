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
