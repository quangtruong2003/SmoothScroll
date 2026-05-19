import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow } from "./SettingRow";
import type { ModifierPassthrough } from "@/lib/tauri";

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

function PrecisionActionsSectionInner() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const mp = settings.modifier_passthrough;

  const update = (partial: Partial<ModifierPassthrough>) =>
    patch({ modifier_passthrough: { ...mp, ...partial } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.precision")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="passthrough-ctrl"
          title={isMac ? t("precision.cmd_label") : t("precision.ctrl_label")}
          description={t("precision.ctrl_help")}
        >
          <Switch
            id="passthrough-ctrl"
            checked={mp.ctrl}
            onCheckedChange={(v) => update({ ctrl: v })}
          />
        </SettingRow>
        <SettingRow
          htmlFor="passthrough-alt"
          title={t("precision.alt_label")}
          description={t("precision.alt_help")}
        >
          <Switch
            id="passthrough-alt"
            checked={mp.alt}
            onCheckedChange={(v) => update({ alt: v })}
          />
        </SettingRow>
        <SettingRow
          htmlFor="clear-inertia"
          title={t("precision.clear_inertia_label")}
          description={t("precision.clear_inertia_help")}
        >
          <Switch
            id="clear-inertia"
            checked={mp.clear_inertia_on_press}
            onCheckedChange={(v) => update({ clear_inertia_on_press: v })}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}

export const PrecisionActionsSection = memo(PrecisionActionsSectionInner);
