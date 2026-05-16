import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";

export function DirectionSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.direction")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="reverse-wheel"
          title={t("settings.reverse_wheel.title")}
          description={t("settings.reverse_wheel.desc")}
        >
          <Switch
            id="reverse-wheel"
            checked={settings.reverse_wheel_direction}
            onCheckedChange={(v) => patch({ reverse_wheel_direction: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="horizontal-smoothness"
          title={t("settings.horizontal_smoothness.title")}
          description={t("settings.horizontal_smoothness.desc")}
        >
          <Switch
            id="horizontal-smoothness"
            checked={settings.horizontal_smoothness}
            onCheckedChange={(v) => patch({ horizontal_smoothness: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="shift-horizontal"
          title={t("settings.shift_horizontal.title")}
          description={t("settings.shift_horizontal.desc")}
        >
          <Switch
            id="shift-horizontal"
            checked={settings.shift_key_horizontal}
            onCheckedChange={(v) => patch({ shift_key_horizontal: v })}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
