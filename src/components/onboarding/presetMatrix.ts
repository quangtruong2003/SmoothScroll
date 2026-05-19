import type { AppSettings, OnboardingUseCase, OnboardingFeel } from "@/lib/tauri";

/**
 * UI mirror of `crates/core/src/onboarding.rs::apply_preset` for Step 3
 * preview. Returns a new AppSettings without mutating the input. Keep in
 * lockstep with the Rust matrix.
 */
export function applyPresetUI(
  base: AppSettings,
  useCase: OnboardingUseCase,
  feel: OnboardingFeel,
): AppSettings {
  const s: AppSettings = { ...base };
  const macLike = () => {
    s.step_size_px = 100;
    s.animation_time_ms = 500;
    s.acceleration_delta_ms = 80;
    s.acceleration_max = 6;
  };
  const fast = () => {
    s.step_size_px = 160;
    s.animation_time_ms = 280;
    s.acceleration_delta_ms = 50;
    s.acceleration_max = 10;
  };
  const snappy = () => {
    s.step_size_px = 200;
    s.animation_time_ms = 200;
    s.acceleration_delta_ms = 30;
    s.acceleration_max = 14;
  };
  const def = () => {
    s.step_size_px = 120;
    s.animation_time_ms = 360;
    s.acceleration_delta_ms = 70;
    s.acceleration_max = 7;
  };
  const enableMP = () => {
    s.modifier_passthrough = {
      ctrl: true,
      alt: true,
      clear_inertia_on_press: true,
    };
  };

  const k = `${useCase}/${feel}`;
  switch (k) {
    case "Reader/Glide":      macLike(); break;
    case "Reader/Balanced":   def(); s.step_size_px = 100; break;
    case "Reader/Snappy":     fast(); break;
    case "Coder/Glide":       def(); s.animation_time_ms = 300; enableMP(); break;
    case "Coder/Balanced":    def(); enableMP(); break;
    case "Coder/Snappy":      snappy(); enableMP(); break;
    case "Designer/Glide":    macLike(); s.step_size_px = 80; enableMP(); break;
    case "Designer/Balanced": def(); enableMP(); break;
    case "Designer/Snappy":   fast(); enableMP(); break;
    case "General/Glide":     macLike(); break;
    case "General/Balanced":  def(); break;
    case "General/Snappy":    snappy(); break;
  }
  return s;
}
