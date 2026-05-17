import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";
import { ScrollPresets } from "./ScrollPresets";
import { ResetButton } from "./ResetButton";

const DEFAULTS = {
  step_size_px: 120,
  animation_time_ms: 360,
  acceleration_delta_ms: 70,
  acceleration_max: 7,
  tail_to_head_ratio: 6,
};

export function ScrollSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.scrolling")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <ScrollPresets />
        <SettingRow
          htmlFor="step-size"
          title={t("settings.step_size.title")}
          description={t("settings.step_size.desc")}
          trailing={`${settings.step_size_px}px`}
        >
          <Slider
            id="step-size"
            value={[settings.step_size_px]}
            min={10}
            max={500}
            step={5}
            className="w-48"
            onValueChange={([v]) => patch({ step_size_px: v })}
          />
          <ResetButton
            onClick={() => patch({ step_size_px: DEFAULTS.step_size_px })}
            disabled={settings.step_size_px === DEFAULTS.step_size_px}
          />
        </SettingRow>

        <SettingRow
          htmlFor="anim-time"
          title={t("settings.anim_time.title")}
          description={t("settings.anim_time.desc")}
          trailing={`${settings.animation_time_ms}ms`}
        >
          <Slider
            id="anim-time"
            value={[settings.animation_time_ms]}
            min={50}
            max={1500}
            step={10}
            className="w-48"
            onValueChange={([v]) => patch({ animation_time_ms: v })}
          />
          <ResetButton
            onClick={() => patch({ animation_time_ms: DEFAULTS.animation_time_ms })}
            disabled={settings.animation_time_ms === DEFAULTS.animation_time_ms}
          />
        </SettingRow>

        <SettingRow
          htmlFor="accel-delta"
          title={t("settings.accel_window.title")}
          description={t("settings.accel_window.desc")}
          trailing={`${settings.acceleration_delta_ms}ms`}
        >
          <Slider
            id="accel-delta"
            value={[settings.acceleration_delta_ms]}
            min={0}
            max={300}
            step={5}
            className="w-48"
            onValueChange={([v]) => patch({ acceleration_delta_ms: v })}
          />
          <ResetButton
            onClick={() => patch({ acceleration_delta_ms: DEFAULTS.acceleration_delta_ms })}
            disabled={settings.acceleration_delta_ms === DEFAULTS.acceleration_delta_ms}
          />
        </SettingRow>

        <SettingRow
          htmlFor="accel-max"
          title={t("settings.accel_max.title")}
          description={t("settings.accel_max.desc")}
          trailing={`${settings.acceleration_max}x`}
        >
          <Slider
            id="accel-max"
            value={[settings.acceleration_max]}
            min={1}
            max={20}
            step={1}
            className="w-48"
            onValueChange={([v]) => patch({ acceleration_max: v })}
          />
          <ResetButton
            onClick={() => patch({ acceleration_max: DEFAULTS.acceleration_max })}
            disabled={settings.acceleration_max === DEFAULTS.acceleration_max}
          />
        </SettingRow>

        <SettingRow
          htmlFor="tail-ratio"
          title={t("settings.tail_ratio.title")}
          description={t("settings.tail_ratio.desc")}
          trailing={`${settings.tail_to_head_ratio}`}
        >
          <Slider
            id="tail-ratio"
            value={[settings.tail_to_head_ratio]}
            min={1}
            max={20}
            step={1}
            className="w-48"
            onValueChange={([v]) => patch({ tail_to_head_ratio: v })}
          />
          <ResetButton
            onClick={() => patch({ tail_to_head_ratio: DEFAULTS.tail_to_head_ratio })}
            disabled={settings.tail_to_head_ratio === DEFAULTS.tail_to_head_ratio}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
