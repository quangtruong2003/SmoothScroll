import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  AppWindow,
  Info,
  Keyboard,
  Palette,
  Sliders,
} from "lucide-react";

export type TabKey =
  | "general"
  | "scroll"
  | "apps"
  | "hotkey"
  | "appearance"
  | "about";

interface TabDef {
  key: TabKey;
  labelKey: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: "general", labelKey: "tabs.general", icon: <Activity className="h-4 w-4" /> },
  { key: "scroll", labelKey: "tabs.scroll", icon: <Sliders className="h-4 w-4" /> },
  { key: "apps", labelKey: "tabs.apps", icon: <AppWindow className="h-4 w-4" /> },
  { key: "hotkey", labelKey: "tabs.hotkey", icon: <Keyboard className="h-4 w-4" /> },
  { key: "appearance", labelKey: "tabs.appearance", icon: <Palette className="h-4 w-4" /> },
  { key: "about", labelKey: "tabs.about", icon: <Info className="h-4 w-4" /> },
];

interface SidebarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  t: (key: string) => string;
}

export function Sidebar({ active, onChange, t }: SidebarProps) {
  return (
    <nav
      aria-label="Settings tabs"
      className="flex h-full w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3"
    >
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        SmoothScroll
      </div>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
