import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useTheme } from "@/stores/settingsStore";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { Sidebar, type TabKey } from "@/components/Sidebar";
import { EnableHeader } from "@/components/settings/EnableHeader";
import { TestSandboxSection } from "@/components/settings/TestSandboxSection";
import { ScrollSection } from "@/components/settings/ScrollSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DirectionSection } from "@/components/settings/DirectionSection";
import { PrecisionActionsSection } from "@/components/settings/PrecisionActionsSection";
import { KeyboardScrollSection } from "@/components/settings/KeyboardScrollSection";
import { TouchpadSection } from "@/components/settings/TouchpadSection";
import { ExcludedAppsSection } from "@/components/settings/ExcludedAppsSection";
import { ProfilesSection } from "@/components/settings/ProfilesSection";
import { BehaviorSection } from "@/components/settings/BehaviorSection";
import { GameModeSection } from "@/components/settings/GameModeSection";
import { AboutSection } from "@/components/settings/AboutSection";
import { EdgeScrollSection } from "@/components/settings/EdgeScrollSection";
import { TabContent } from "@/components/settings/TabContent";

export function SettingsPage() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const setEnabledFromEvent = useSettingsStore((s) => s.setEnabledFromEvent);
  const theme = useTheme();
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
    const stop = watchSystemTheme(() => {
      if (theme === "System") applyTheme("System");
    });
    return stop;
  }, [theme]);

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
        <div
          key={tab}
          className="mx-auto h-full max-w-2xl animate-tab-in"
        >
          {tab === "general" && (
            <TabContent
              title={t("tabs.general.title")}
              description={t("tabs.general.description")}
              scrollable={false}
            >
              <EnableHeader />
              <TestSandboxSection />
            </TabContent>
          )}

          {tab === "scroll" && (
            <TabContent
              title={t("tabs.scroll.title")}
              description={t("tabs.scroll.description")}
            >
              <ScrollSection />
              <AppearanceSection />
              <DirectionSection />
              <PrecisionActionsSection />
              <EdgeScrollSection />
              <KeyboardScrollSection />
              <TouchpadSection />
            </TabContent>
          )}

          {tab === "apps" && (
            <TabContent
              title={t("tabs.apps.title")}
              description={t("tabs.apps.description")}
            >
              <ProfilesSection />
              <ExcludedAppsSection />
            </TabContent>
          )}

          {tab === "preferences" && (
            <TabContent
              title={t("tabs.preferences.title")}
              description={t("tabs.preferences.description")}
            >
              <BehaviorSection />
              <GameModeSection />
            </TabContent>
          )}

          {tab === "about" && (
            <TabContent
              title={t("tabs.about.title")}
              description={t("tabs.about.description")}
              scrollable={false}
            >
              <AboutSection />
            </TabContent>
          )}
        </div>
      </main>
    </div>
  );
}
