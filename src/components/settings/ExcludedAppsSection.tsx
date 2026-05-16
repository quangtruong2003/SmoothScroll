import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri } from "@/lib/tauri";
import { AddAppDialog } from "./AddAppDialog";

export function ExcludedAppsSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  if (!settings) return null;

  const excluded = settings.excluded_apps;

  const handleAdd = async (name: string) => {
    try {
      await tauri.addExcludedApp(name);
      await load();
    } catch (e) {
      console.error("addExcludedApp failed", e);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await tauri.removeExcludedApp(name);
      await load();
    } catch (e) {
      console.error("removeExcludedApp failed", e);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("section.excluded_apps")}</CardTitle>
        <AddAppDialog excludedNames={excluded} onAdd={handleAdd} />
      </CardHeader>
      <CardContent>
        {excluded.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("excluded.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {excluded.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="font-medium">{name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("excluded.remove_aria", { name })}
                  onClick={() => handleRemove(name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
