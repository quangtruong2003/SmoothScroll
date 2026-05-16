import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { tauri } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";

export function BehaviorSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [autostart, setAutostartState] = useState(false);

  useEffect(() => {
    tauri.getAutostart().then(setAutostartState);
  }, []);

  if (!settings) return null;

  const onAutostart = async (next: boolean) => {
    try {
      await tauri.setAutostart(next);
      setAutostartState(next);
    } catch (e) {
      console.error("setAutostart failed", e);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.behavior")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="hotkey-toggle"
          title={t("settings.global_hotkey.title")}
          description={t("settings.global_hotkey.desc")}
        >
          <Switch
            id="hotkey-toggle"
            checked={settings.enable_global_hotkey}
            onCheckedChange={(v) => patch({ enable_global_hotkey: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="autostart"
          title={t("settings.start_with_os.title")}
          description={t("settings.start_with_os.desc")}
        >
          <Switch
            id="autostart"
            checked={autostart}
            onCheckedChange={onAutostart}
          />
        </SettingRow>

        <SettingRow
          htmlFor="start-minimized"
          title={t("settings.start_minimized.title")}
          description={t("settings.start_minimized.desc")}
        >
          <Switch
            id="start-minimized"
            checked={settings.start_minimized}
            onCheckedChange={(v) => patch({ start_minimized: v })}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
