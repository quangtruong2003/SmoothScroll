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
import { FlagIcon } from "@/components/FlagIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

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
      <Select
        value={currentLang}
        onValueChange={(v) => onLangChange(v as Lang)}
      >
        <SelectTrigger
          aria-label={t("section.language")}
          className="w-full h-8 px-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FlagIcon lang={currentLang} />
            <span className="truncate">{t(`language.${currentLang}`)}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-popover backdrop-blur-none">
          {SUPPORTED_LANGS.map((l) => (
            <SelectItem key={l} value={l}>
              <div className="flex items-center gap-2">
                <FlagIcon lang={l} />
                <span>{t(`language.${l}`)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {version && (
        <div className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
          v{version}
        </div>
      )}
    </div>
  );
}
