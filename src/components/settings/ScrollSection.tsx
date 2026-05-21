import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore, useScrollFields, useDefaults } from "@/stores/settingsStore";
import { animationTimeFeel, stepSizeFeel, accelMaxFeel } from "@/lib/feelHints";
import { SettingRow } from "./SettingRow";
import { ResetButton } from "./ResetButton";

function ScrollSectionInner() {
  const { t } = useTranslation();
  const fields = useScrollFields();
  const defaults = useDefaults();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.scrolling")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="step-size"
          title={t("settings.step_size.title")}
          description={t("settings.step_size.desc")}
          trailing={`${fields.step_size_px}px · ${t(stepSizeFeel(fields.step_size_px))}`}
        >
          <Slider
            id="step-size"
            value={[fields.step_size_px]}
            min={10}
            max={500}
            step={5}
            className="w-40"
            onValueChange={([v]) => patch({ step_size_px: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ step_size_px: defaults.step_size_px })}
              disabled={fields.step_size_px === defaults.step_size_px}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="anim-time"
          title={t("settings.anim_time.title")}
          description={t("settings.anim_time.desc")}
          trailing={`${fields.animation_time_ms}ms · ${t(animationTimeFeel(fields.animation_time_ms))}`}
        >
          <Slider
            id="anim-time"
            value={[fields.animation_time_ms]}
            min={50}
            max={1500}
            step={10}
            className="w-40"
            onValueChange={([v]) => patch({ animation_time_ms: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ animation_time_ms: defaults.animation_time_ms })}
              disabled={fields.animation_time_ms === defaults.animation_time_ms}
            />
          )}
        </SettingRow>

        <SettingRow
          htmlFor="accel-max"
          title={t("settings.accel_max.title")}
          description={t("settings.accel_max.desc")}
          trailing={`${fields.acceleration_max}x · ${t(accelMaxFeel(fields.acceleration_max))}`}
        >
          <Slider
            id="accel-max"
            value={[fields.acceleration_max]}
            min={1}
            max={20}
            step={1}
            className="w-40"
            onValueChange={([v]) => patch({ acceleration_max: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ acceleration_max: defaults.acceleration_max })}
              disabled={fields.acceleration_max === defaults.acceleration_max}
            />
          )}
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const ScrollSection = memo(ScrollSectionInner);
