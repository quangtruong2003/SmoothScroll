import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { tauri } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { HotkeyRecorderInput } from "@/components/HotkeyRecorderInput";
import { SettingRow } from "./SettingRow";
import { toast } from "@/components/ui/toast";

export function BehaviorSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [autostart, setAutostartState] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);

  useEffect(() => {
    tauri.getAutostart().then(setAutostartState);
  }, []);

  if (!settings) return null;

  const onAutostart = async (next: boolean) => {
    try {
      await tauri.setAutostart(next);
      setAutostartState(next);
    } catch (e) {
      toast.error(t("errors.autostart_failed"));
    }
  };

  const onHotkeyEnabledChange = async (next: boolean) => {
    setHotkeyError(null);
    patch({ enable_global_hotkey: next });
    try {
      await tauri.setHotkeyEnabled(next);
    } catch (e) {
      toast.error(t("errors.hotkey_toggle_failed"));
      patch({ enable_global_hotkey: !next });
    }
  };

  const onHotkeyCommit = async (accel: string) => {
    setHotkeyError(null);
    const previous = settings.hotkey_accelerator;
    patch({ hotkey_accelerator: accel });
    try {
      await tauri.setHotkeyAccelerator(accel);
      toast.success(t("settings.hotkey_accelerator.saved"));
    } catch (e) {
      toast.error(t("errors.hotkey_save_failed"));
      patch({ hotkey_accelerator: previous });
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
            onCheckedChange={onHotkeyEnabledChange}
          />
        </SettingRow>

        <SettingRow
          htmlFor="hotkey-accel"
          title={t("settings.hotkey_accelerator.title")}
          description={t("settings.hotkey_accelerator.desc")}
        >
          <div className="flex flex-col items-end gap-1">
            <HotkeyRecorderInput
              value={settings.hotkey_accelerator}
              onCommit={onHotkeyCommit}
              disabled={!settings.enable_global_hotkey}
            />
            {hotkeyError && (
              <span className="text-xs text-destructive max-w-[12rem] text-right">
                {hotkeyError}
              </span>
            )}
          </div>
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
