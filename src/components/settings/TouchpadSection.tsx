import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri, type InputSourceLabel } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON: Record<InputSourceLabel, string> = {
  Wheel: "🖱️",
  HighResWheel: "🖱️ ⚡",
  Touchpad: "💻",
};

export function TouchpadSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [source, setSource] = useState<InputSourceLabel>("Wheel");

  useEffect(() => {
    const interval = setInterval(() => {
      tauri.getInputSource().then(setSource);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.touchpad")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded p-2 text-sm bg-muted">
          {t("touchpad.detected")}: {ICON[source]} {source}
        </div>

        <div className="flex items-center justify-between">
          <Label>{t("touchpad.enable_smoothing")}</Label>
          <Switch
            checked={settings.touchpad_smoothing_enabled}
            onCheckedChange={(v) => patch({ touchpad_smoothing_enabled: v })}
          />
        </div>

        <div>
          <Label>
            {t("touchpad.pixel_multiplier", {
              value: settings.touchpad_pixel_multiplier.toFixed(2),
            })}
          </Label>
          <Slider
            min={0.5} max={3} step={0.1}
            value={[settings.touchpad_pixel_multiplier]}
            onValueChange={([v]) => patch({ touchpad_pixel_multiplier: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </div>

        <div>
          <Label>
            {t("touchpad.acceleration_factor", {
              value: settings.touchpad_acceleration_factor.toFixed(2),
            })}
          </Label>
          <Slider
            min={0} max={3} step={0.1}
            value={[settings.touchpad_acceleration_factor]}
            onValueChange={([v]) => patch({ touchpad_acceleration_factor: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
