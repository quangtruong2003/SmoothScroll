import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useTheme } from "@/stores/settingsStore";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { tauri, type AppSettings } from "@/lib/tauri";
import { Sidebar, type TabKey } from "@/components/Sidebar";
import { WindowChrome } from "@/components/WindowChrome";
import { EnableHeader } from "@/components/settings/EnableHeader";
import { AdvancedScrollSection } from "@/components/settings/AdvancedScrollSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DirectionSection } from "@/components/settings/DirectionSection";
import { TouchpadSection } from "@/components/settings/TouchpadSection";
import { ExcludedAppsSection } from "@/components/settings/AppProfilesSection";
import { ProfilesSection } from "@/components/settings/ProfilesSection";
import { MonitorProfiles } from "@/components/settings/MonitorProfiles";
import { BehaviorSection } from "@/components/settings/BehaviorSection";
import { GameModeSection } from "@/components/settings/GameModeSection";
import { AboutSection } from "@/components/settings/AboutSection";
// import { SupportSection } from "@/components/settings/SupportSection";
import { BackupSection } from "@/components/settings/BackupSection";
// import { StatsTab } from "@/components/settings/StatsTab";  // Hidden until analytics feature is ready
import { TabContent } from "@/components/settings/TabContent";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { CheatSheetOverlay } from "@/components/CheatSheetOverlay";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { BatteryHint } from "@/components/BatteryHint";
import { bumpSession } from "@/lib/localStats";

export function SettingsPage() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const setEnabledFromEvent = useSettingsStore((s) => s.setEnabledFromEvent);
  const setStartWithOsFromEvent = useSettingsStore((s) => s.setStartWithOsFromEvent);
  const theme = useTheme();
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  const [tab, setTab] = useState<TabKey>("scroll");
  const [wizardOpen, setWizardOpen] = useState(false);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    load();
    bumpSession();
  }, [load]);

  // Show onboarding wizard on first run, when timestamp is null AND key
  // settings are still at defaults (so migrated users with custom config
  // don't get bothered).
  useEffect(() => {
    if (loading || !settings) return;
    if (settings.onboarding_completed_at != null) return;
    const tweaked =
      settings.step_size_px !== 144 ||
      settings.animation_time_ms !== 220 ||
      settings.max_velocity !== 20 ||
      settings.acceleration_max !== 10;
    if (tweaked) {
      void tauri.skipOnboarding();
      return;
    }
    setWizardOpen(true);
  }, [loading, settings]);

  useEffect(() => {
    const unlistenPromise = listen<boolean>("enabled-changed", (event) => {
      setEnabledFromEvent(Boolean(event.payload));
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {
        // ignore
      });
    };
  }, [setEnabledFromEvent]);

  useEffect(() => {
    const unlistenPromise = listen<Partial<AppSettings>>("settings-changed", (event) => {
      const next = event.payload;
      if (next && typeof next.start_with_os === "boolean") {
        setStartWithOsFromEvent(next.start_with_os);
      }
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {
        // ignore
      });
    };
  }, [setStartWithOsFromEvent]);

  useEffect(() => {
    const unlistenPromise = listen<string>("navigate-to", (event) => {
      const section = event.payload;
      if (section === "excluded-apps") setTab("apps");
    });
    return () => {
      unlistenPromise.then((u) => u()).catch(() => {
        // ignore
      });
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
    <div className="main-root flex h-screen flex-col overflow-hidden">
      <WindowChrome />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={tab} onChange={setTab} t={t} />
        <main className="main-content flex-1 overflow-hidden px-6 py-5">
        <div
          key={tab}
          className="mx-auto h-full max-w-2xl animate-tab-in"
        >
          {tab === "scroll" && (
            <TabContent
              title={t("tabs.scroll.title")}
              description={t("tabs.scroll.description")}
              scrollable={true}
            >
              <BatteryHint />
              <EnableHeader />
              <DirectionSection />
              <AppearanceSection />
            </TabContent>
          )}

          {tab === "devices" && (
            <TabContent
              title={t("tabs.devices.title")}
              description={t("tabs.devices.description")}
            >
              <TouchpadSection />
            </TabContent>
          )}

          {tab === "advanced" && (
            <TabContent
              title={t("tabs.advanced.title")}
              description={t("tabs.advanced.description")}
            >
              <AdvancedScrollSection />
            </TabContent>
          )}

          {tab === "apps" && (
            <TabContent
              title={t("tabs.apps.title")}
              description={t("tabs.apps.description")}
            >
              <ProfilesSection />
              <MonitorProfiles />
              <ExcludedAppsSection />
            </TabContent>
          )}

          {tab === "gamemode" && (
            <TabContent
              title={t("tabs.gamemode.title")}
              description={t("tabs.gamemode.description")}
            >
              <GameModeSection />
            </TabContent>
          )}

          {tab === "behavior" && (
            <TabContent
              title={t("tabs.behavior.title")}
              description={t("tabs.behavior.description")}
            >
              <BehaviorSection />
            </TabContent>
          )}

          {/* Stats tab hidden until analytics feature is ready */}
          {/* {tab === "stats" && (
            <TabContent
              title={t("tabs.stats.title")}
              description={t("tabs.stats.description")}
            >
              <StatsTab />
            </TabContent>
          )} */}

          {tab === "about" && (
            <TabContent
              title={t("tabs.about.title")}
              description={t("tabs.about.description")}
              scrollable={true}
            >
              <AboutSection />
              {/* <SupportSection /> */}
              <BackupSection />
            </TabContent>
          )}
        </div>
      </main>
      </div>
      {wizardOpen && <OnboardingWizard onClose={() => setWizardOpen(false)} />}
      <CheatSheetOverlay />
      <WhatsNewModal />
    </div>
  );
}
