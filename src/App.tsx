import { useEffect, useState } from "react";
import { SettingsPage } from "./routes/Settings";
import { PermissionGate } from "./components/macos/PermissionGate";
import { TrayPanel } from "./components/TrayPanel";
import { tauri } from "./lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function App() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label);

    tauri
      .accessibilityStatus()
      .then(setGranted)
      .catch(() => setGranted(true));
  }, []);

  // Tray panel window renders TrayPanel directly
  if (windowLabel === "tray-panel") {
    return <TrayPanel />;
  }

  // Main window
  if (granted === null) return null;
  if (!granted) return <PermissionGate onGranted={() => setGranted(true)} />;

  return <SettingsPage />;
}
