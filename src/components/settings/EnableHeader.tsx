import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { tauri } from "@/lib/tauri";
import { useSettingsStore, useEnabled } from "@/stores/settingsStore";
import { ScrollPresets } from "./ScrollPresets";

function EnableHeaderInner() {
  const { t } = useTranslation();
  const settingsEnabled = useEnabled();
  const patch = useSettingsStore((s) => s.patch);
  const [trayEnabled, setTrayEnabled] = useState<boolean>(true);

  useEffect(() => {
    tauri.getEnabled().then(setTrayEnabled);
  }, []);

  const enabled = settingsEnabled && trayEnabled;

  const onToggle = async (next: boolean) => {
    patch({ enabled: next });
    await tauri.setEnabled(next);
    setTrayEnabled(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
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
      <ScrollPresets />
    </div>
  );
}

export const EnableHeader = memo(EnableHeaderInner);
