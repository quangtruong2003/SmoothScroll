import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore, useScrollFields, useDefaults } from "@/stores/settingsStore";
import { animationTimeFeel, stepSizeFeel, accelMaxFeel } from "@/lib/feelHints";
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

        <SettingRow
          htmlFor="max-velocity"
          title={t("settings.max_velocity.title")}
          description={t("settings.max_velocity.desc")}
          trailing={`${fields.max_velocity}`}
        >
          <Slider
            id="max-velocity"
            value={[fields.max_velocity]}
            min={5}
            max={50}
            step={1}
            className="w-40"
            onValueChange={([v]) => patch({ max_velocity: v })}
          />
          {defaults && (
            <ResetButton
              onClick={() => patch({ max_velocity: defaults.max_velocity })}
              disabled={fields.max_velocity === defaults.max_velocity}
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