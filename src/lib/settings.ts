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
  shiftHorizontalInvert: boolean;
  horizontalSmoothness: boolean;
  reverseWheelDirection: boolean;
  startWithOs: boolean;
  startMinimized: boolean;
  language: string;
  enableGlobalHotkey: boolean;
  showTrayIconState: boolean;
  excludedApps: string[];

  // Auto-disable: Windows apps that already have native smooth scrolling.
  autoDisableWindowsApps: boolean;
}

export const defaultSettings: AppSettings = {
  enabled: true,
  stepSizePx: 144,
  animationTimeMs: 220,
  accelerationDeltaMs: 70,
  accelerationMax: 10,
  tailToHeadRatio: 3,
  animationEasing: true,
  easingMode: "QuinticOut",
  shiftKeyHorizontal: true,
  shiftHorizontalInvert: true,
  horizontalSmoothness: true,
  reverseWheelDirection: false,
  startWithOs: false,
  startMinimized: true,
  language: "en",
  enableGlobalHotkey: true,
  showTrayIconState: true,
  excludedApps: [],
  autoDisableWindowsApps: true,
};
