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
  const labelPrefix = ctx.suggested_category_label
    ? `${ctx.suggested_category_label}: `
    : "";

  const handleToggle = async (enabled: boolean) => {
    const name = ctx.process_name;
    if (!name) return;
    if (enabled) {
      await invoke("unassign_app_profile", { processName: name }).catch(() => {
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
    <div className="tray-row">
      <span className="tray-row-icon">
        {ctx.app_icon_base64 ? (
          <img
            src={`data:image/png;base64,${ctx.app_icon_base64}`}
            className="tray-row-app-icon"
            alt=""
            draggable={false}
          />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>
      <span className="tray-row-label">{labelPrefix}{displayName}</span>
      <Switch checked={!isDisabled} onCheckedChange={handleToggle} />
    </div>
  );
}
