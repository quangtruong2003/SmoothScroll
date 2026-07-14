import { describe, expect, it } from "vitest";
import { PRESETS, ORDER, activePreset, type PresetKey } from "./scrollPresets";

const EXPECTED_VALUES: Record<PresetKey, Record<string, number>> = {
  slow: {
    step_size_px: 80,
    animation_time_ms: 600,
    max_velocity: 10,
    acceleration_max: 4,
  },
  default: {
    step_size_px: 144,
    animation_time_ms: 220,
    max_velocity: 20,
    acceleration_max: 10,
  },
  fast: {
    step_size_px: 160,
    animation_time_ms: 280,
    max_velocity: 30,
    acceleration_max: 10,
  },
  snappy: {
    step_size_px: 200,
    animation_time_ms: 200,
    max_velocity: 40,
    acceleration_max: 14,
  },
  mac_like: {
    step_size_px: 100,
    animation_time_ms: 500,
    max_velocity: 15,
    acceleration_max: 6,
  },
  linear: {
    step_size_px: 120,
    animation_time_ms: 360,
    max_velocity: 5,
    acceleration_max: 1,
  },
};

describe("scrollPresets", () => {
  it("presets_match_original_scrollpresets", () => {
    for (const key of ORDER) {
      expect(PRESETS[key]).toEqual(EXPECTED_VALUES[key]);
    }
  });

  it("preset_order_stable", () => {
    expect(ORDER).toEqual([
      "slow",
      "default",
      "fast",
      "snappy",
      "mac_like",
      "linear",
    ]);
  });

  it("activePreset_returns_key_for_matching_settings", () => {
    const mockSettings = {
      ...PRESETS.fast,
      enabled: true,
      horizontal_invert: false,
    } as any;
    expect(activePreset(mockSettings)).toBe("fast");
  });

  it("activePreset_returns_null_when_no_match", () => {
    const mockSettings = {
      ...PRESETS.fast,
      step_size_px: 999,
      enabled: true,
    } as any;
    expect(activePreset(mockSettings)).toBeNull();
  });
});
