import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { tauri, type ForegroundAppContext, type AppSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

const DISABLED_PROFILE_ID = "__disabled__";
const DEFAULT_VALUE = "__default__";

export function CurrentAppCard() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings) as AppSettings | null;
  const profiles = settings?.profiles ?? [];

  const [ctx, setCtx] = useState<ForegroundAppContext | null>(null);

  const refresh = useCallback(async () => {
    try {
      const c = await tauri.getForegroundAppContext();
      setCtx(c);
    } catch {
      setCtx(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const un = listen("settings-changed", () => void refresh());
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => {
      un.then((u) => u()).catch(() => {});
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (!ctx?.process_name) return null;

  const currentValue = ctx.is_excluded
    ? DISABLED_PROFILE_ID
    : (ctx.current_profile_id ?? DEFAULT_VALUE);

  const onSelect = async (value: string) => {
    const name = ctx.process_name;
    if (!name) return;
    if (value === DEFAULT_VALUE) {
      await invoke("unassign_app_profile", { processName: name });
      await invoke("remove_excluded_app", { name }).catch(() => {});
    } else if (value === DISABLED_PROFILE_ID) {
      await invoke("assign_app_profile", {
        processName: name,
        profileId: DISABLED_PROFILE_ID,
      });
    } else {
      await invoke("assign_app_profile", { processName: name, profileId: value });
    }
    await refresh();
  };

  const onToggleDisable = async (checked: boolean) => {
    const name = ctx.process_name;
    if (!name) return;
    if (checked) {
      await invoke("assign_app_profile", {
        processName: name,
        profileId: DISABLED_PROFILE_ID,
      });
    } else {
      await invoke("unassign_app_profile", { processName: name });
    }
    await refresh();
  };

  return (
    <div className="mx-2 my-2 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("tray.current_app.heading")}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{ctx.process_name}</div>
      {ctx.suggested_category_label && (
        <div className="text-xs text-muted-foreground">
          {t("tray.current_app.category", {
            category: ctx.suggested_category_label,
          })}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("tray.current_app.profile")}
        </span>
        <Select value={currentValue} onValueChange={onSelect}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VALUE}>
              {t("tray.current_app.default")}
            </SelectItem>
            <SelectItem value={DISABLED_PROFILE_ID}>
              {t("tray.current_app.disabled")}
            </SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs">
        <Switch checked={ctx.is_excluded} onCheckedChange={onToggleDisable} />
        <span>{t("tray.current_app.disable_for_this_app")}</span>
      </label>
    </div>
  );
}
