import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore, useScrollFields, useDefaults } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";
import { ResetButton } from "./ResetButton";

function AdvancedScrollSectionInner() {
  const { t } = useTranslation();
  const fields = useScrollFields();
  const defaults = useDefaults();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.advanced_scroll")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="accel-delta"
          title={t("settings.accel_window.title")}
          description={t("settings.accel_window.desc")}
          trailing={`${fields.acceleration_delta_ms}ms`}
        >
          <Slider
            id="accel-delta"
            value={[fields.acceleration_delta_ms]}
            min={0}
            max={300}
            step={5}
            className="w-40"
            onValueChange={([v]) => patch({ acceleration_delta_ms: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ acceleration_delta_ms: defaults.acceleration_delta_ms })}
              disabled={fields.acceleration_delta_ms === defaults.acceleration_delta_ms}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="tail-ratio"
          title={t("settings.tail_ratio.title")}
          description={t("settings.tail_ratio.desc")}
          trailing={`${fields.tail_to_head_ratio}`}
        >
          <Slider
            id="tail-ratio"
            value={[fields.tail_to_head_ratio]}
            min={1}
            max={20}
            step={1}
            className="w-40"
            onValueChange={([v]) => patch({ tail_to_head_ratio: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ tail_to_head_ratio: defaults.tail_to_head_ratio })}
              disabled={fields.tail_to_head_ratio === defaults.tail_to_head_ratio}
            />
          )}
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const AdvancedScrollSection = memo(AdvancedScrollSectionInner);
