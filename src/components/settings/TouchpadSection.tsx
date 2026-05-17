import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useTouchpadFields } from "@/stores/settingsStore";
import { tauri, type InputSourceLabel } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingRow } from "./SettingRow";

const ICON: Record<InputSourceLabel, string> = {
  Wheel: "🖱️",
  HighResWheel: "🖱️ ⚡",
  Touchpad: "💻",
};

function TouchpadSectionInner() {
  const { t } = useTranslation();
  const fields = useTouchpadFields();
  const patch = useSettingsStore((s) => s.patch);
  const [source, setSource] = useState<InputSourceLabel>("Wheel");

  useEffect(() => {
    let cancelled = false;
    void tauri.getInputSource().then((s) => {
      if (!cancelled) setSource(s);
    });
    const unlistenP = listen<InputSourceLabel>("input-source-changed", (e) => {
      setSource(e.payload);
    });
    return () => {
      cancelled = true;
      unlistenP.then((u) => u()).catch(() => {});
    };
  }, []);

  if (!fields) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.touchpad")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
          <span className="text-muted-foreground">{t("settings.touchpad.detected")}:</span>
          <span aria-hidden>{ICON[source]}</span>
          <span className="font-medium">{t(`settings.touchpad.source.${source}`)}</span>
        </div>

        <SettingRow
          htmlFor="touchpad-enable"
          title={t("settings.touchpad.enable.title")}
          description={t("settings.touchpad.enable.desc")}
        >
          <Switch
            id="touchpad-enable"
            checked={fields.touchpad_smoothing_enabled}
            onCheckedChange={(v) => patch({ touchpad_smoothing_enabled: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="touchpad-mult"
          title={t("settings.touchpad.pixel_multiplier.title")}
          description={t("settings.touchpad.pixel_multiplier.desc")}
          trailing={`${fields.touchpad_pixel_multiplier.toFixed(2)}x`}
        >
          <Slider
            id="touchpad-mult"
            min={0.5}
            max={3}
            step={0.1}
            className="w-48"
            value={[fields.touchpad_pixel_multiplier]}
            onValueChange={([v]) => patch({ touchpad_pixel_multiplier: v })}
            disabled={!fields.touchpad_smoothing_enabled}
          />
        </SettingRow>

        <SettingRow
          htmlFor="touchpad-accel"
          title={t("settings.touchpad.acceleration.title")}
          description={t("settings.touchpad.acceleration.desc")}
          trailing={`${fields.touchpad_acceleration_factor.toFixed(2)}x`}
        >
          <Slider
            id="touchpad-accel"
            min={0}
            max={3}
            step={0.1}
            className="w-48"
            value={[fields.touchpad_acceleration_factor]}
            onValueChange={([v]) => patch({ touchpad_acceleration_factor: v })}
            disabled={!fields.touchpad_smoothing_enabled}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const TouchpadSection = memo(TouchpadSectionInner);
