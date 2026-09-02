import { describe, expect, it } from "vitest";
import type { AppSettings } from "@/lib/tauri";
import { applyPresetUI } from "./presetMatrix";

describe("applyPresetUI semantic wheel defaults", () => {
  it("restores Preserve + SmoothPulses for onboarding presets", () => {
    const base = {
      shift_wheel_behavior: "ConvertToHorizontal",
      wheel_output_mode: "Raw",
    } as AppSettings;

    const result = applyPresetUI(base, "General", "Balanced");

    expect(result.shift_wheel_behavior).toBe("Preserve");
    expect(result.wheel_output_mode).toBe("SmoothPulses");
  });
});
