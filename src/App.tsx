import { useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { SettingsPage } from "./routes/Settings";
import { PermissionGate } from "./components/macos/PermissionGate";
import { TrayPanel } from "./components/TrayPanel";
import { ForcedUpdateModal } from "./components/ForcedUpdateModal";
import { tauri } from "./lib/tauri";
import { checkForUpdate } from "./lib/updater";
import { getCurrentWindow } from "@tauri-apps/api/window";

type UpdateGateState =
  | { kind: "checking" }
  | { kind: "skip" }
  | { kind: "available"; update: Update; currentVersion: string };

export default function App() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [updateGate, setUpdateGate] = useState<UpdateGateState>({ kind: "checking" });

  useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label);

    if (label === "tray-panel") return;

    tauri
      .accessibilityStatus()
      .then(setGranted)
      .catch(() => setGranted(true));
  }, []);

  useEffect(() => {
    if (windowLabel !== "main") return;
    let cancelled = false;
    void (async () => {
      const result = await checkForUpdate();
      if (cancelled) return;
      if (result.state === "available") {
        // Force show window so user sees the modal even if started in tray
        await tauri.showMainWindow().catch(() => {});
        setUpdateGate({
          kind: "available",
          update: result.update,
          currentVersion: result.currentVersion,
        });
      } else {
        // up-to-date OR error (offline) → let user use the app
        setUpdateGate({ kind: "skip" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowLabel]);

  const [trusted, setTrusted] = useState(false);
  useEffect(() => {
    tauri
      .isTrustedDevice()
      .then(setTrusted)
      .catch(() => setTrusted(false));
  }, []);

  // Tray panel window renders TrayPanel directly
  if (windowLabel === "tray-panel") {
    return <TrayPanel />;
  }

  if (updateGate.kind === "available") {
    return (
      <ForcedUpdateModal
        update={updateGate.update}
        currentVersion={updateGate.currentVersion}
        canSkip={trusted}
        onSkip={() => setUpdateGate({ kind: "skip" })}
      />
    );
  }

  // Don't render Settings until the update check resolves — avoids a flash
  if (updateGate.kind === "checking") return null;

  // Main window
  if (granted === null) return null;
  if (!granted) return <PermissionGate onGranted={() => setGranted(true)} />;

  return <SettingsPage />;
}
