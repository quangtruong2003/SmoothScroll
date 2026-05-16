import { useEffect, useState } from "react";
import { SettingsPage } from "./routes/Settings";
import { PermissionGate } from "./components/macos/PermissionGate";
import { tauri } from "./lib/tauri";

export default function App() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    tauri
      .accessibilityStatus()
      .then(setGranted)
      .catch(() => setGranted(true));
  }, []);

  if (granted === null) return null;
  if (!granted) return <PermissionGate onGranted={() => setGranted(true)} />;
  return <SettingsPage />;
}
