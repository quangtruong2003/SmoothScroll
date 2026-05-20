/**
 * Human-readable hints for raw scroll-tuning values. Surfaced under sliders
 * so users build a mental model instead of staring at millisecond numbers.
 *
 * Returned strings are i18n keys; callers translate them with `t()`.
 */

export function animationTimeFeel(ms: number): string {
  if (ms < 150) return "feel.anim.snappy";
  if (ms <= 300) return "feel.anim.balanced";
  if (ms <= 600) return "feel.anim.glide";
  return "feel.anim.dreamy";
}

export function stepSizeFeel(px: number): string {
  if (px < 90) return "feel.step.fine";
  if (px < 160) return "feel.step.standard";
  if (px < 220) return "feel.step.bold";
  return "feel.step.huge";
}

export function accelMaxFeel(x: number): string {
  if (x <= 2) return "feel.accel.flat";
  if (x <= 6) return "feel.accel.gentle";
  if (x <= 12) return "feel.accel.responsive";
  return "feel.accel.aggressive";
}
