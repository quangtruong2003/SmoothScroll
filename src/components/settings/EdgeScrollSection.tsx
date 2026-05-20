import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, useEdgeScrollFields, useDefaults } from "@/stores/settingsStore";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ResetButton } from "./ResetButton";

function EdgeScrollSectionInner() {
  const { t } = useTranslation();
  const fields = useEdgeScrollFields();
  const defaults = useDefaults();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.edge_scroll")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="edge-scroll-enabled">
            {t("settings.edge_scroll.enable")}
          </Label>
          <Switch
            id="edge-scroll-enabled"
            checked={fields.edge_scroll_enabled}
            onCheckedChange={(v) => patch({ edge_scroll_enabled: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>
            {t("settings.edge_scroll.zone_size", { value: fields.edge_scroll_zone_px })}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              min={10}
              max={200}
              step={5}
              value={[fields.edge_scroll_zone_px]}
              onValueChange={([v]) => patch({ edge_scroll_zone_px: v })}
              disabled={!fields.edge_scroll_enabled}
            />
            {defaults && (
              <ResetButton
                onClick={() => patch({ edge_scroll_zone_px: defaults.edge_scroll_zone_px })}
                disabled={fields.edge_scroll_zone_px === defaults.edge_scroll_zone_px}
              />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>
            {t("settings.edge_scroll.max_speed", {
              value: fields.edge_scroll_max_notches_per_sec.toFixed(1),
            })}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              min={0.5}
              max={20}
              step={0.5}
              value={[fields.edge_scroll_max_notches_per_sec]}
              onValueChange={([v]) => patch({ edge_scroll_max_notches_per_sec: v })}
              disabled={!fields.edge_scroll_enabled}
            />
            {defaults && (
              <ResetButton
                onClick={() => patch({ edge_scroll_max_notches_per_sec: defaults.edge_scroll_max_notches_per_sec })}
                disabled={fields.edge_scroll_max_notches_per_sec === defaults.edge_scroll_max_notches_per_sec}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const EdgeScrollSection = memo(EdgeScrollSectionInner);
