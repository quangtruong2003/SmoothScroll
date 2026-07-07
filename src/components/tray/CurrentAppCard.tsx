import { useEffect, useState, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { tauri, type ForegroundAppContext, type AppCategory } from "@/lib/tauri";

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

  const isDisabled = ctx.is_excluded;
  const category = ctx.suggested_category ?? "Unknown";
  const Icon = CATEGORY_ICON[category];
  const displayName = prettifyProcessName(ctx.process_name);

  const handleToggle = async (enabled: boolean) => {
    const name = ctx.process_name;
    if (!name) return;
    if (enabled) {
      await invoke("remove_excluded_app", { name }).catch(() => {
        // ignore
      });
    } else {
      await invoke("assign_app_profile", {
        processName: name,
        profileId: "__disabled__",
      });
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
        </div>
        <Switch
          checked={!isDisabled}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}
