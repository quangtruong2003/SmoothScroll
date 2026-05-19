import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { tauri, type AppSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { ScrollComparePane } from "@/components/preview/ScrollComparePane";

function SinglePane() {
  const { t } = useTranslation();
  const items = useMemo(
    () => Array.from({ length: 100 }, (_, i) => i + 1),
    [],
  );
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("test_scroll.description")}
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/20 p-4">
        <ul className="space-y-2 text-sm font-mono">
          {items.map((n) => (
            <li
              key={n}
              className="flex items-center justify-between border-b border-dashed border-border/50 pb-1 last:border-b-0"
            >
              <span className="text-muted-foreground">#{n}</span>
              <span>{t("test_scroll.line", { n })}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * In-app scrollable area so users can feel current scroll settings without
 * leaving the Settings window. Single-pane mode uses the OS-level engine via
 * the global wheel hook. Compare mode runs an isolated WASM engine for
 * side-by-side feel of saved (A) vs draft (B) settings.
 */
export function TestSandboxSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setAll = useSettingsStore((s) => s.setAll);
  const reload = useSettingsStore((s) => s.load);

  const [compareOn, setCompareOn] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<AppSettings | null>(null);

  const enableCompare = async (v: boolean) => {
    setCompareOn(v);
    if (v) {
      const fromDisk = await tauri.getSettings();
      setSavedSnapshot(fromDisk);
    } else {
      setSavedSnapshot(null);
    }
  };

  const onApplyB = async () => {
    if (!settings) return;
    await tauri.saveSettings(settings);
    await reload();
    setSavedSnapshot(settings);
  };

  const onSwap = () => {
    if (!savedSnapshot || !settings) return;
    const previousDraft = settings;
    setAll(savedSnapshot);
    setSavedSnapshot(previousDraft);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("section.test_scroll")}</CardTitle>
        <label className="flex items-center gap-2 text-xs">
          <span>{t("compare.toggle")}</span>
          <Switch checked={compareOn} onCheckedChange={enableCompare} />
        </label>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col gap-3">
        {compareOn && savedSnapshot && settings ? (
          <ScrollComparePane
            settingsA={savedSnapshot}
            settingsB={settings}
            onApplyB={onApplyB}
            onSwap={onSwap}
          />
        ) : (
          <SinglePane />
        )}
      </CardContent>
    </Card>
  );
}
