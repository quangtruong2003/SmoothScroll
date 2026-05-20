import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollPreviewArea } from "@/components/preview/ScrollPreviewArea";
import { useWasmEngine } from "@/components/preview/useWasmEngine";
import { SamplePreviewContent } from "@/components/preview/sampleContent";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri, type OnboardingUseCase, type OnboardingFeel } from "@/lib/tauri";
import { applyPresetUI } from "./presetMatrix";
import { initialWizardState, wizardReducer } from "./wizardReducer";

interface Props {
  onClose: () => void;
}

const USE_CASES: OnboardingUseCase[] = ["Reader", "Coder", "Designer", "General"];
const FEELS: OnboardingFeel[] = ["Glide", "Balanced", "Snappy"];

export function OnboardingWizard({ onClose }: Props) {
  const { t } = useTranslation();
  const [introSeen, setIntroSeen] = useState(false);
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const baseSettings = useSettingsStore((s) => s.settings);
  const reload = useSettingsStore((s) => s.load);

  const previewSettings =
    baseSettings && state.useCase && state.feel
      ? applyPresetUI(baseSettings, state.useCase, state.feel)
      : baseSettings;
  const engine = useWasmEngine(previewSettings ?? null);

  const finish = async () => {
    if (!state.useCase || !state.feel) return;
    await tauri.applyOnboardingPreset(state.useCase, state.feel);
    await reload();
    onClose();
  };

  // "Just smooth it" — apply General/Balanced default and finish immediately.
  const justSmoothIt = async () => {
    await tauri.applyOnboardingPreset("General", "Balanced");
    await reload();
    onClose();
  };

  const skip = async () => {
    await tauri.skipOnboarding();
    await reload();
    onClose();
  };

  // Intro screen — quick "Why SmoothScroll" before tuning.
  if (!introSeen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
        <div className="w-[600px] max-w-[90vw] rounded-xl border border-border bg-background p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold">
            {t("onboarding_intro.title", "Welcome to SmoothScroll")}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-center text-sm text-muted-foreground">
            {t(
              "onboarding_intro.body",
              "We'll get your wheel feeling buttery smooth in under a minute. Pick a path below.",
            )}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={justSmoothIt}
              className="w-full"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t("onboarding_intro.just_smooth", "Just smooth it (recommended)")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIntroSeen(true)}
              className="w-full"
            >
              {t("onboarding_intro.guided", "Tune it for me (3 quick steps)")}
            </Button>
            <button
              type="button"
              onClick={skip}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("onboarding.skip", "Skip — I'll configure later")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
      <div className="w-[600px] max-w-[90vw] rounded-xl border border-border bg-background p-6 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t(`onboarding.step${state.step}.title`)}
          </h2>
          <button className="text-xs text-muted-foreground" onClick={skip}>
            {t("onboarding.skip")}
          </button>
        </header>

        {state.step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("onboarding.step1.subtitle")}
            </p>
            {USE_CASES.map((uc) => (
              <button
                key={uc}
                onClick={() => dispatch({ type: "set_use_case", value: uc })}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                  state.useCase === uc
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <strong>{t(`onboarding.use_case.${uc}.label`)}</strong>
                <div className="text-xs text-muted-foreground">
                  {t(`onboarding.use_case.${uc}.help`)}
                </div>
              </button>
            ))}
          </div>
        )}

        {state.step === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("onboarding.step2.subtitle")}
            </p>
            {FEELS.map((f) => (
              <button
                key={f}
                onClick={() => dispatch({ type: "set_feel", value: f })}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                  state.feel === f
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <strong>{t(`onboarding.feel.${f}.label`)}</strong>
                <div className="text-xs text-muted-foreground">
                  {t(`onboarding.feel.${f}.help`)}
                </div>
              </button>
            ))}
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("onboarding.step3.subtitle")}
            </p>
            <ScrollPreviewArea engine={engine} active={true}>
              <SamplePreviewContent />
            </ScrollPreviewArea>
          </div>
        )}

        <footer className="mt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "back" })}
            disabled={state.step === 1}
          >
            {t("onboarding.back")}
          </Button>
          {state.step < 3 ? (
            <Button
              onClick={() => dispatch({ type: "next" })}
              disabled={
                (state.step === 1 && !state.useCase) ||
                (state.step === 2 && !state.feel)
              }
            >
              {t("onboarding.next")}
            </Button>
          ) : (
            <Button onClick={finish}>{t("onboarding.finish")}</Button>
          )}
        </footer>
      </div>
    </div>
  );
}
