export type EasingMode = "ExponentialOut" | "CubicOut" | "QuinticOut" | "Linear";

export interface AppSettings {
  enabled: boolean;
  stepSizePx: number;
  animationTimeMs: number;
  accelerationDeltaMs: number;
  accelerationMax: number;
  tailToHeadRatio: number;
  animationEasing: boolean;
  easingMode: EasingMode;
  shiftKeyHorizontal: boolean;
  horizontalSmoothness: boolean;
  reverseWheelDirection: boolean;
  startWithOs: boolean;
  startMinimized: boolean;
  language: string;
  enableGlobalHotkey: boolean;
  showTrayIconState: boolean;
  excludedApps: string[];
}

export const defaultSettings: AppSettings = {
  enabled: true,
  stepSizePx: 120,
  animationTimeMs: 360,
  accelerationDeltaMs: 70,
  accelerationMax: 7,
  tailToHeadRatio: 3,
  animationEasing: true,
  easingMode: "ExponentialOut",
  shiftKeyHorizontal: true,
  horizontalSmoothness: true,
  reverseWheelDirection: false,
  startWithOs: false,
  startMinimized: true,
  language: "en",
  enableGlobalHotkey: true,
  showTrayIconState: true,
  excludedApps: [],
};
