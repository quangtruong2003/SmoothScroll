import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";
import type { EasingMode } from "@/lib/tauri";
import { EasingCurvePreview } from "@/components/EasingCurvePreview";
import { SettingRow } from "./SettingRow";

export function AppearanceSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const easingLabels: Record<EasingMode, string> = {
    ExponentialOut: t("settings.easing_curve.ExponentialOut"),
    CubicOut: t("settings.easing_curve.CubicOut"),
    QuinticOut: t("settings.easing_curve.QuinticOut"),
    Linear: t("settings.easing_curve.Linear"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.animation")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="easing-toggle"
          title={t("settings.easing_toggle.title")}
          description={t("settings.easing_toggle.desc")}
        >
          <Switch
            id="easing-toggle"
            checked={settings.animation_easing}
            onCheckedChange={(v) => patch({ animation_easing: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="easing-mode"
          title={t("settings.easing_curve.title")}
          description={t("settings.easing_curve.desc")}
        >
          <Select
            value={settings.easing_mode}
            onValueChange={(v) => patch({ easing_mode: v as EasingMode })}
          >
            <SelectTrigger id="easing-mode" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(easingLabels) as [EasingMode, string][]).map(
                ([mode, label]) => (
                  <SelectItem key={mode} value={mode}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </SettingRow>

        <div className="flex flex-col gap-2 py-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("settings.easing_curve.preview")}
          </span>
          <EasingCurvePreview
            mode={settings.easing_mode}
            tailToHeadRatio={settings.tail_to_head_ratio}
            enabled={settings.animation_easing}
          />
        </div>
      </CardContent>
    </Card>
  );
}
