import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { PRESETS, ORDER, activePreset } from "@/lib/scrollPresets";

export function ScrollPresets() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const active = activePreset(settings);

  return (
    <div className="space-y-1.5 pb-3">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => patch(PRESETS[key])}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent",
            )}
          >
            {t(`presets.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
