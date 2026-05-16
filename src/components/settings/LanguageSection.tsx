import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLanguage, SUPPORTED_LANGS, type Lang } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri } from "@/lib/tauri";
import { SettingRow } from "./SettingRow";

export function LanguageSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);

  if (!settings) return null;

  const onChange = async (next: Lang) => {
    setLanguage(next);
    patch({ language: next });
    try {
      await tauri.changeLanguage(next);
    } catch (e) {
      console.error("changeLanguage failed", e);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.language")}</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingRow htmlFor="language-select" title={t("language.select_label")}>
          <Select
            value={settings.language}
            onValueChange={(v) => onChange(v as Lang)}
          >
            <SelectTrigger id="language-select" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGS.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`language.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </CardContent>
    </Card>
  );
}
