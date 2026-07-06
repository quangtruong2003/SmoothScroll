import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  AppWindow,
  Gamepad2,
  Info,
  Keyboard,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sliders,
  Sun,
  Wrench,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { setLanguage, SUPPORTED_LANGS, type Lang } from "@/i18n";
import { tauri, type ThemeMode } from "@/lib/tauri";
import { IS_LINUX } from "@/lib/platform";
import { FlagIcon } from "@/components/FlagIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export type TabKey =
  | "scroll"
  | "devices"
  | "advanced"
  | "apps"
  | "gamemode"
  | "behavior"
  | "about";

interface TabDef {
  key: TabKey;
  labelKey: string;
  icon: ReactNode;
}

const ALL_TABS: TabDef[] = [
  { key: "scroll", labelKey: "tabs.scroll.label", icon: <Sliders className="h-4 w-4" /> },
  { key: "devices", labelKey: "tabs.devices.label", icon: <Keyboard className="h-4 w-4" /> },
  { key: "advanced", labelKey: "tabs.advanced.label", icon: <Wrench className="h-4 w-4" /> },
  { key: "apps", labelKey: "tabs.apps.label", icon: <AppWindow className="h-4 w-4" /> },
  { key: "gamemode", labelKey: "tabs.gamemode.label", icon: <Gamepad2 className="h-4 w-4" /> },
  { key: "behavior", labelKey: "tabs.behavior.label", icon: <SettingsIcon className="h-4 w-4" /> },
  { key: "about", labelKey: "tabs.about.label", icon: <Info className="h-4 w-4" /> },
];

// Linux: hide apps, gamemode tabs (no foreground app detection, no game process detection)
const TABS = IS_LINUX
  ? ALL_TABS.filter((t) => t.key !== "apps" && t.key !== "gamemode")
  : ALL_TABS;

interface SidebarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  t: (key: string) => string;
}

export function Sidebar({ active, onChange, t }: SidebarProps) {
  return (
    <nav
      aria-label={t("sidebar.tabs_aria")}
      className="native-sidebar flex h-full w-44 shrink-0 flex-col p-2"
    >
      <div className="native-sidebar-list flex flex-col gap-0.5">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "sidebar-item relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
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
    void tauri.appVersion().then(setVersion);
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
                "flex flex-1 items-center justify-center rounded py-1 transition-all duration-150 ease-out",
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
        <div className="px-1 text-center text-[0.77rem] tabular-nums text-muted-foreground">
          v{version}
        </div>
      )}
    </div>
  );
}
