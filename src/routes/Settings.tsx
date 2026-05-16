import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { EnableHeader } from "@/components/settings/EnableHeader";
import { ScrollSection } from "@/components/settings/ScrollSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DirectionSection } from "@/components/settings/DirectionSection";
import { ExcludedAppsSection } from "@/components/settings/ExcludedAppsSection";
import { BehaviorSection } from "@/components/settings/BehaviorSection";
import { LanguageSection } from "@/components/settings/LanguageSection";
import { AboutSection } from "@/components/settings/AboutSection";

export function SettingsPage() {
  const { t } = useTranslation();
  const load = useSettingsStore((s) => s.load);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    load();
  }, [load]);

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
      <ScrollSection />
      <AppearanceSection />
      <DirectionSection />
      <ExcludedAppsSection />
      <BehaviorSection />
      <LanguageSection />
      <AboutSection />
    </div>
  );
}
