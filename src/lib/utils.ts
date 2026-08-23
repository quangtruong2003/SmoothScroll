import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/// Mirror of Rust `AppSettings::canonicalize_process_name`: trim, strip a
/// trailing ".exe", collapse whitespace, lowercase. `app_profiles` keys are
/// stored canonical, so frontend lookups must canonicalize too.
export function canonicalizeProcessName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withoutExe = trimmed.length >= 4 && trimmed.slice(-4).toLowerCase() === ".exe"
    ? trimmed.slice(0, -4)
    : trimmed;
  return withoutExe.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}
