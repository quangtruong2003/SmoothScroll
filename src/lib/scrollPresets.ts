import type { AppSettings } from "@/lib/tauri";

export type PresetKey =
  | "slow"
  | "default"
  | "fast"
  | "snappy"
  | "mac_like"
  | "linear";

export interface PresetValues {
  step_size_px: number;
  animation_time_ms: number;
  max_velocity: number;
  acceleration_max: number;
}

export const PRESETS: Record<PresetKey, PresetValues> = {
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

export const ORDER: PresetKey[] = [
  "slow",
  "default",
  "fast",
  "snappy",
  "mac_like",
  "linear",
];

export function activePreset(s: AppSettings): PresetKey | null {
  for (const k of ORDER) {
    const p = PRESETS[k];
    if (
      s.step_size_px === p.step_size_px &&
      s.animation_time_ms === p.animation_time_ms &&
      s.max_velocity === p.max_velocity &&
      s.acceleration_max === p.acceleration_max
    ) {
      return k;
    }
  }
  return null;
}
