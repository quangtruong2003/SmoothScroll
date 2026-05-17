import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { Sidebar, type TabKey } from "@/components/Sidebar";
import { EnableHeader } from "@/components/settings/EnableHeader";
import { TestSandboxSection } from "@/components/settings/TestSandboxSection";
import { ScrollSection } from "@/components/settings/ScrollSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DirectionSection } from "@/components/settings/DirectionSection";
import { KeyboardScrollSection } from "@/components/settings/KeyboardScrollSection";
import { TouchpadSection } from "@/components/settings/TouchpadSection";
import { ExcludedAppsSection } from "@/components/settings/ExcludedAppsSection";
import { ProfilesSection } from "@/components/settings/ProfilesSection";
import { BehaviorSection } from "@/components/settings/BehaviorSection";
import { GameModeSection } from "@/components/settings/GameModeSection";
import { AboutSection } from "@/components/settings/AboutSection";
import { EdgeScrollSection } from "@/components/settings/EdgeScrollSection";

export function SettingsPage() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const setEnabledFromEvent = useSettingsStore((s) => s.setEnabledFromEvent);
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  const [tab, setTab] = useState<TabKey>("general");

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unlistenPromise = listen<boolean>("enabled-changed", (event) => {
      setEnabledFromEvent(Boolean(event.payload));
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {});
    };
  }, [setEnabledFromEvent]);

  useEffect(() => {
    const unlistenPromise = listen<string>("navigate-to", (event) => {
      const section = event.payload;
      if (section === "excluded-apps") setTab("apps");
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {});
    };
  }, []);

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={tab} onChange={setTab} t={t} />
      <main className="flex-1 overflow-hidden px-6 py-5">
        <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
          {tab === "general" && (
            <>
              <EnableHeader />
              <TestSandboxSection />
            </>
          )}
          {tab === "scroll" && (
            <div className="overflow-y-auto pr-1">
              <div className="space-y-3">
                <ScrollSection />
                <AppearanceSection />
                <DirectionSection />
                <EdgeScrollSection />
                <KeyboardScrollSection />
                <TouchpadSection />
              </div>
            </div>
          )}
          {tab === "apps" && (
            <div className="overflow-y-auto pr-1">
              <div className="space-y-3">
                <ProfilesSection />
                <ExcludedAppsSection />
              </div>
            </div>
          )}
          {tab === "preferences" && (
            <div className="overflow-y-auto pr-1">
              <div className="space-y-3">
                <BehaviorSection />
                <GameModeSection />
              </div>
            </div>
          )}
          {tab === "about" && <AboutSection />}
        </div>
      </main>
    </div>
  );
}
