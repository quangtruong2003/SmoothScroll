import type { ThemeMode } from "./tauri";

/**
 * Apply the chosen theme to the document root by toggling the `dark` class
 * that Tailwind's class-based dark mode reads.
 */
export function applyTheme(mode: ThemeMode): void {
  const resolved =
    mode === "System"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "Dark"
        : "Light"
      : mode;
  document.documentElement.classList.toggle("dark", resolved === "Dark");
}

/**
 * Subscribe to OS-level theme changes. Returns an unsubscribe function.
 * Caller should call it when their effect cleans up.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
