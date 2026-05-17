import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS = ["PageUp", "PageDown", "Space", "ShiftSpace", "ArrowUp", "ArrowDown"];

export function KeyboardScrollSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const toggleKey = (key: string) => {
    const enabled = settings.keyboard_scroll_keys.includes(key);
    const next = enabled
      ? settings.keyboard_scroll_keys.filter((k) => k !== key)
      : [...settings.keyboard_scroll_keys, key];
    patch({ keyboard_scroll_keys: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyboard scroll smoothing <span className="text-xs text-muted-foreground">(Windows only)</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable keyboard smoothing</Label>
          <Switch
            checked={settings.keyboard_scroll_enabled}
            onCheckedChange={(v) => patch({ keyboard_scroll_enabled: v })}
          />
        </div>

        <div>
          <Label>Active keys</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {KEYS.map((k) => {
              const on = settings.keyboard_scroll_keys.includes(k);
              return (
                <button
                  key={k}
                  className={`rounded border px-2 py-0.5 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => toggleKey(k)}
                  disabled={!settings.keyboard_scroll_enabled}
                >{k}</button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>PageUp/PageDown step: {settings.keyboard_pgdn_step_notches} notches</Label>
          <Slider
            min={1} max={20} step={1}
            value={[settings.keyboard_pgdn_step_notches]}
            onValueChange={([v]) => patch({ keyboard_pgdn_step_notches: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>

        <div>
          <Label>Arrow step: {settings.keyboard_arrow_step_notches} notches</Label>
          <Slider
            min={1} max={10} step={1}
            value={[settings.keyboard_arrow_step_notches]}
            onValueChange={([v]) => patch({ keyboard_arrow_step_notches: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Skip in text inputs</Label>
          <Switch
            checked={settings.keyboard_smart_text_skip}
            onCheckedChange={(v) => patch({ keyboard_smart_text_skip: v })}
            disabled={!settings.keyboard_scroll_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
