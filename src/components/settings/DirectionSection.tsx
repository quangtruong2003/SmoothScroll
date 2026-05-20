import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore, useDirectionFields } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";

function DirectionSectionInner() {
  const { t } = useTranslation();
  const fields = useDirectionFields();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

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
            checked={fields.reverse_wheel_direction}
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
            checked={fields.horizontal_smoothness}
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
            checked={fields.shift_key_horizontal}
            onCheckedChange={(v) => patch({ shift_key_horizontal: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="shift-horizontal-invert"
          title={t("settings.shift_horizontal_invert.title")}
          description={t("settings.shift_horizontal_invert.desc")}
        >
          <Switch
            id="shift-horizontal-invert"
            checked={fields.shift_horizontal_invert}
            onCheckedChange={(v) => patch({ shift_horizontal_invert: v })}
            disabled={!fields.shift_key_horizontal}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const DirectionSection = memo(DirectionSectionInner);
