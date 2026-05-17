import { useSettingsStore } from "@/stores/settingsStore";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function EdgeScrollSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edge auto-scroll</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="edge-scroll-enabled">Enable edge auto-scroll</Label>
          <Switch
            id="edge-scroll-enabled"
            checked={settings.edge_scroll_enabled}
            onCheckedChange={(v) => patch({ edge_scroll_enabled: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>Zone size: {settings.edge_scroll_zone_px}px</Label>
          <Slider
            min={10}
            max={200}
            step={5}
            value={[settings.edge_scroll_zone_px]}
            onValueChange={([v]) => patch({ edge_scroll_zone_px: v })}
            disabled={!settings.edge_scroll_enabled}
          />
        </div>
        <div className="space-y-2">
          <Label>
            Max speed: {settings.edge_scroll_max_notches_per_sec.toFixed(1)} notches/s
          </Label>
          <Slider
            min={0.5}
            max={20}
            step={0.5}
            value={[settings.edge_scroll_max_notches_per_sec]}
            onValueChange={([v]) => patch({ edge_scroll_max_notches_per_sec: v })}
            disabled={!settings.edge_scroll_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
