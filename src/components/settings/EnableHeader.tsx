import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { tauri } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

export function EnableHeader() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [trayEnabled, setTrayEnabled] = useState<boolean>(true);

  useEffect(() => {
    tauri.getEnabled().then(setTrayEnabled);
  }, []);

  if (!settings) return null;

  const enabled = settings.enabled && trayEnabled;

  const onToggle = async (next: boolean) => {
    patch({ enabled: next });
    await tauri.setEnabled(next);
    setTrayEnabled(next);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div>
        <Label htmlFor="enabled-toggle" className="text-base font-semibold">
          {t("app.title")}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {enabled ? t("app.tagline_on") : t("app.tagline_off")}
        </p>
      </div>
      <Switch
        id="enabled-toggle"
        checked={enabled}
        onCheckedChange={onToggle}
        aria-label={t("app.title")}
      />
    </div>
  );
}
