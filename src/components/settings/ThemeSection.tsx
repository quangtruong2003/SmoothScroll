import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ThemeMode } from "@/lib/tauri";
import { SettingRow } from "./SettingRow";

export function ThemeSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const labels: Record<ThemeMode, string> = {
    Light: t("settings.theme.Light"),
    Dark: t("settings.theme.Dark"),
    System: t("settings.theme.System"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.theme")}</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingRow
          htmlFor="theme-mode"
          title={t("settings.theme.title")}
          description={t("settings.theme.desc")}
        >
          <Select
            value={settings.theme}
            onValueChange={(v) => patch({ theme: v as ThemeMode })}
          >
            <SelectTrigger id="theme-mode" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(labels) as [ThemeMode, string][]).map(
                ([mode, label]) => (
                  <SelectItem key={mode} value={mode}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </SettingRow>
      </CardContent>
    </Card>
  );
}
