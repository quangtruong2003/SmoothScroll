import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AppWindow,
  Globe,
  Code2,
  FileText,
  Terminal,
  MessageCircle,
  Image as ImageIcon,
  Gamepad2,
  Briefcase,
  Ban,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tauri, type ForegroundAppContext, type AppSettings, type AppCategory } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

const DISABLED_PROFILE_ID = "__disabled__";
const DEFAULT_VALUE = "__default__";

const CATEGORY_ICON: Record<AppCategory, LucideIcon> = {
  Browser: Globe,
  Ide: Code2,
  Office: Briefcase,
  Pdf: FileText,
  Terminal: Terminal,
  Chat: MessageCircle,
  Media: ImageIcon,
  Game: Gamepad2,
  Unknown: AppWindow,
};

/** Turn `smoothscroll-app.exe` into `SmoothScroll App`. */
function prettifyProcessName(raw: string): string {
  const stem = raw.replace(/\.exe$/i, "");
  return stem
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]/.test(part) && /[a-z]/.test(part)) return part;
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

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
      un.then((u) => u()).catch(() => {
        // ignore
      });
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (!ctx?.process_name) return null;

  const currentValue = ctx.is_excluded
    ? DISABLED_PROFILE_ID
    : (ctx.current_profile_id ?? DEFAULT_VALUE);

  const category = ctx.suggested_category ?? "Unknown";
  const Icon = CATEGORY_ICON[category];
  const isDisabled = currentValue === DISABLED_PROFILE_ID;
  const displayName = prettifyProcessName(ctx.process_name);

  const onSelect = async (value: string) => {
    const name = ctx.process_name;
    if (!name) return;
    if (value === DEFAULT_VALUE) {
      await invoke("unassign_app_profile", { processName: name });
      await invoke("remove_excluded_app", { name }).catch(() => {
        // ignore
      });
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

  return (
    <div className="mx-2 my-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isDisabled
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          {isDisabled ? <Ban className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">
            {displayName}
          </div>
          <div className="mt-0.5 truncate text-[0.846rem] text-muted-foreground">
            {isDisabled
              ? t("tray.current_app.smoothing_off")
              : ctx.suggested_category_label && category !== "Unknown"
                ? ctx.suggested_category_label
                : t("tray.current_app.smoothing_on")}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Select value={currentValue} onValueChange={onSelect}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VALUE}>
              {t("tray.current_app.default")}
            </SelectItem>
            <SelectItem value={DISABLED_PROFILE_ID}>
              {t("tray.current_app.disabled")}
            </SelectItem>
            {profiles.length > 0 && profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
