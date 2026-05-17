import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, useKeyboardFields, useDefaults } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetButton } from "./ResetButton";

const KEYS = ["PageUp", "PageDown", "Space", "ShiftSpace", "ArrowUp", "ArrowDown"];

function KeyboardScrollSectionInner() {
  const { t } = useTranslation();
  const fields = useKeyboardFields();
  const defaults = useDefaults();
  const patch = useSettingsStore((s) => s.patch);
  if (!fields) return null;

  const toggleKey = (key: string) => {
    const enabled = fields.keyboard_scroll_keys.includes(key);
    const next = enabled
      ? fields.keyboard_scroll_keys.filter((k) => k !== key)
      : [...fields.keyboard_scroll_keys, key];
    patch({ keyboard_scroll_keys: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("section.keyboard_scroll")}{" "}
          <span className="text-xs text-muted-foreground">
            {t("keyboard_scroll.windows_only")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t("keyboard_scroll.enable_smoothing")}</Label>
          <Switch
            checked={fields.keyboard_scroll_enabled}
            onCheckedChange={(v) => patch({ keyboard_scroll_enabled: v })}
          />
        </div>

        <div>
          <Label>{t("keyboard_scroll.active_keys")}</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {KEYS.map((k) => {
              const on = fields.keyboard_scroll_keys.includes(k);
              return (
                <button
                  key={k}
                  className={`rounded border px-2 py-0.5 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => toggleKey(k)}
                  disabled={!fields.keyboard_scroll_enabled}
                >{k}</button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>
            {t("keyboard_scroll.pgdn_step", {
              value: fields.keyboard_pgdn_step_notches,
            })}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              min={1} max={20} step={1}
              value={[fields.keyboard_pgdn_step_notches]}
              onValueChange={([v]) => patch({ keyboard_pgdn_step_notches: v })}
              disabled={!fields.keyboard_scroll_enabled}
            />
            {defaults && (
              <ResetButton
                onClick={() => patch({ keyboard_pgdn_step_notches: defaults.keyboard_pgdn_step_notches })}
                disabled={fields.keyboard_pgdn_step_notches === defaults.keyboard_pgdn_step_notches}
              />
            )}
          </div>
        </div>

        <div>
          <Label>
            {t("keyboard_scroll.arrow_step", {
              value: fields.keyboard_arrow_step_notches,
            })}
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              min={1} max={10} step={1}
              value={[fields.keyboard_arrow_step_notches]}
              onValueChange={([v]) => patch({ keyboard_arrow_step_notches: v })}
              disabled={!fields.keyboard_scroll_enabled}
            />
            {defaults && (
              <ResetButton
                onClick={() => patch({ keyboard_arrow_step_notches: defaults.keyboard_arrow_step_notches })}
                disabled={fields.keyboard_arrow_step_notches === defaults.keyboard_arrow_step_notches}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t("keyboard_scroll.skip_in_text_inputs")}</Label>
          <Switch
            checked={fields.keyboard_smart_text_skip}
            onCheckedChange={(v) => patch({ keyboard_smart_text_skip: v })}
            disabled={!fields.keyboard_scroll_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export const KeyboardScrollSection = memo(KeyboardScrollSectionInner);
