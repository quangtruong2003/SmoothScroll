import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  AppWindow,
  Info,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sliders,
  Sun,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { setLanguage, SUPPORTED_LANGS, type Lang } from "@/i18n";
import { tauri, type ThemeMode } from "@/lib/tauri";

export type TabKey =
  | "general"
  | "scroll"
  | "apps"
  | "preferences"
  | "about";

interface TabDef {
  key: TabKey;
  labelKey: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: "general", labelKey: "tabs.general.label", icon: <Activity className="h-4 w-4" /> },
  { key: "scroll", labelKey: "tabs.scroll.label", icon: <Sliders className="h-4 w-4" /> },
  { key: "apps", labelKey: "tabs.apps.label", icon: <AppWindow className="h-4 w-4" /> },
  { key: "preferences", labelKey: "tabs.preferences.label", icon: <SettingsIcon className="h-4 w-4" /> },
  { key: "about", labelKey: "tabs.about.label", icon: <Info className="h-4 w-4" /> },
];

const FlagIcon = ({ lang }: { lang: Lang }) => {
  const common = { width: 18, height: 12, viewBox: "0 0 18 12" } as const;
  if (lang === "vi") {
    return (
      <svg {...common} aria-hidden className="shrink-0 rounded-[1px]">
        <rect width="18" height="12" fill="#DA251D" />
        <polygon
          points="9,2.4 10.05,5.46 13.32,5.46 10.68,7.32 11.73,10.38 9,8.52 6.27,10.38 7.32,7.32 4.68,5.46 7.95,5.46"
          fill="#FFFF00"
        />
      </svg>
    );
  }
  if (lang === "zh") {
    return (
      <svg {...common} aria-hidden className="shrink-0 rounded-[1px]">
        <rect width="18" height="12" fill="#DE2910" />
        <g fill="#FFDE00">
          <polygon points="3,1.6 3.55,3.05 5.1,3.05 3.85,3.95 4.4,5.4 3,4.5 1.6,5.4 2.15,3.95 0.9,3.05 2.45,3.05" />
          <polygon points="6.3,1 6.55,1.6 7.2,1.6 6.65,1.95 6.85,2.55 6.3,2.15 5.75,2.55 5.95,1.95 5.4,1.6 6.05,1.6" />
          <polygon points="7.2,2.5 7.45,3.1 8.1,3.1 7.55,3.45 7.75,4.05 7.2,3.65 6.65,4.05 6.85,3.45 6.3,3.1 6.95,3.1" />
          <polygon points="7.2,4.6 7.45,5.2 8.1,5.2 7.55,5.55 7.75,6.15 7.2,5.75 6.65,6.15 6.85,5.55 6.3,5.2 6.95,5.2" />
          <polygon points="6.3,6 6.55,6.6 7.2,6.6 6.65,6.95 6.85,7.55 6.3,7.15 5.75,7.55 5.95,6.95 5.4,6.6 6.05,6.6" />
        </g>
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden className="shrink-0 rounded-[1px]">
      <rect width="18" height="12" fill="#B22234" />
      <g fill="#FFFFFF">
        <rect y="0.92" width="18" height="0.92" />
        <rect y="2.77" width="18" height="0.92" />
        <rect y="4.62" width="18" height="0.92" />
        <rect y="6.46" width="18" height="0.92" />
        <rect y="8.31" width="18" height="0.92" />
        <rect y="10.15" width="18" height="0.92" />
      </g>
      <rect width="7.2" height="6.46" fill="#3C3B6E" />
    </svg>
  );
};

interface SidebarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  t: (key: string) => string;
}

export function Sidebar({ active, onChange, t }: SidebarProps) {
  return (
    <nav
      aria-label="Settings tabs"
      className="flex h-full w-44 shrink-0 flex-col border-r bg-muted/30 p-3"
    >
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        SmoothScroll
      </div>
      <div className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-all",
                  isActive ? "bg-primary" : "bg-transparent",
                )}
              />
              {tab.icon}
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
      <SidebarFooter t={t} />
    </nav>
  );
}

function SidebarFooter({ t }: { t: (key: string) => string }) {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [version, setVersion] = useState("");

  useEffect(() => {
    tauri.appVersion().then(setVersion).catch(() => {});
  }, []);

  if (!settings) return null;

  const onThemeChange = (mode: ThemeMode) => {
    patch({ theme: mode });
  };

  const onLangChange = async (next: Lang) => {
    setLanguage(next);
    patch({ language: next });
    try {
      await tauri.changeLanguage(next);
    } catch (e) {
      console.error("changeLanguage failed", e);
    }
  };

  const currentLang = settings.language as Lang;

  const themeOptions: { mode: ThemeMode; icon: ReactNode; labelKey: string }[] = [
    { mode: "Light", icon: <Sun className="h-3.5 w-3.5" />, labelKey: "settings.theme.Light" },
    { mode: "System", icon: <Monitor className="h-3.5 w-3.5" />, labelKey: "settings.theme.System" },
    { mode: "Dark", icon: <Moon className="h-3.5 w-3.5" />, labelKey: "settings.theme.Dark" },
  ];

  return (
    <div className="mt-auto flex flex-col gap-2 border-t pt-3">
      <div
        role="radiogroup"
        aria-label={t("settings.theme.title")}
        className="flex w-full rounded-md border bg-background p-0.5"
      >
        {themeOptions.map(({ mode, icon, labelKey }) => {
          const isActive = settings.theme === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              onClick={() => onThemeChange(mode)}
              className={cn(
                "flex flex-1 items-center justify-center rounded py-1 transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {icon}
            </button>
          );
        })}
      </div>
      <div
        role="radiogroup"
        aria-label={t("section.language")}
        className="flex w-full rounded-md border bg-background p-0.5"
      >
        {SUPPORTED_LANGS.map((l) => {
          const isActive = currentLang === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t(`language.${l}`)}
              title={t(`language.${l}`)}
              onClick={() => onLangChange(l)}
              className={cn(
                "flex flex-1 items-center justify-center rounded py-1 transition-all",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary"
                  : "opacity-60 hover:bg-accent hover:opacity-100",
              )}
            >
              <FlagIcon lang={l} />
            </button>
          );
        })}
      </div>
      {version && (
        <div className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
          v{version}
        </div>
      )}
    </div>
  );
}
