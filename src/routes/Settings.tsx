import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { EnableHeader } from "@/components/settings/EnableHeader";
import { TestSandboxSection } from "@/components/settings/TestSandboxSection";
import { ScrollSection } from "@/components/settings/ScrollSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DirectionSection } from "@/components/settings/DirectionSection";
import { ExcludedAppsSection } from "@/components/settings/ExcludedAppsSection";
import { BehaviorSection } from "@/components/settings/BehaviorSection";
import { ThemeSection } from "@/components/settings/ThemeSection";
import { LanguageSection } from "@/components/settings/LanguageSection";
import { AboutSection } from "@/components/settings/AboutSection";

export function SettingsPage() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const setEnabledFromEvent = useSettingsStore((s) => s.setEnabledFromEvent);
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to enabled-changed events from tray/hotkey/backend.
  useEffect(() => {
    const unlistenPromise = listen<boolean>("enabled-changed", (event) => {
      setEnabledFromEvent(Boolean(event.payload));
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {});
    };
  }, [setEnabledFromEvent]);

  // Re-apply theme when OS theme changes (only matters for theme=System).
  useEffect(() => {
    if (!settings) return;
    const stop = watchSystemTheme(() => {
      if (settings.theme === "System") applyTheme("System");
    });
    return stop;
  }, [settings?.theme]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading_settings")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-destructive">
        {t("common.load_failed", { error })}
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6 space-y-4">
      <EnableHeader />
      <TestSandboxSection />
      <ScrollSection />
      <AppearanceSection />
      <DirectionSection />
      <ExcludedAppsSection />
      <BehaviorSection />
      <ThemeSection />
      <LanguageSection />
      <AboutSection />
    </div>
  );
}
