import { useMemo } from "react";
import type { EasingMode } from "@/lib/tauri";

interface EasingCurvePreviewProps {
  mode: EasingMode;
  tailToHeadRatio: number;
  enabled: boolean;
  width?: number;
  height?: number;
}

/**
 * Mirror of `compute_easing_fraction` in `crates/core/src/easing.rs`.
 * Stays in lock-step with backend logic.
 */
function fraction(t: number, mode: EasingMode, ratio: number, enabled: boolean): number {
  if (!enabled || mode === "Linear") return Math.min(t, 1);
  const x = Math.min(t, 1);
  switch (mode) {
    case "CubicOut":
      return 1 - Math.pow(1 - x, 3);
    case "QuinticOut":
      return 1 - Math.pow(1 - x, 5);
    case "ExponentialOut":
      return 1 - Math.exp(-(2 + ratio) * x);
    default:
      return x;
  }
}

const SAMPLES = 60;

export function EasingCurvePreview({
  mode,
  tailToHeadRatio,
  enabled,
  width = 240,
  height = 80,
}: EasingCurvePreviewProps) {
  const path = useMemo(() => {
    const points: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const f = fraction(t, mode, tailToHeadRatio, enabled);
      const x = t * (width - 4) + 2;
      const y = (1 - f) * (height - 4) + 2;
      points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(" ");
  }, [mode, tailToHeadRatio, enabled, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${mode} curve preview`}
      className="rounded-md border bg-muted/30 text-primary"
    >
      <line
        x1={2}
        y1={height - 2}
        x2={width - 2}
        y2={height - 2}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <line
        x1={2}
        y1={2}
        x2={2}
        y2={height - 2}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
