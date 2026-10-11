/**
 * Detects whether the running build differs from the one the user last saw.
 *
 * Used to fire a one-off donate nudge right after an update lands. A failing
 * version lookup resolves to `null` so the nudge never blocks boot.
 *
 * Policy: the baseline is rolled forward unconditionally, even when the caller
 * ends up suppressing the nudge (cooldown, muted, untrusted device). Holding it
 * back would mean that after the cooldown expires — 60 days later — the user is
 * told they "just updated" to a version that is by then stale. Losing one
 * nudge opportunity beats telling them something untrue.
 */

export const VERSION_KEY = "ss.lastVersion.v1";

export async function detectFreshVersion(
  fetchVersion: () => Promise<string>,
): Promise<string | null> {
  let current: string;
  try {
    current = await fetchVersion();
  } catch {
    return null;
  }
  if (!current) return null;

  let previous: string | null = null;
  try {
    previous = localStorage.getItem(VERSION_KEY);
  } catch {
    // Storage disabled — treat as unknown baseline, no nudge.
  }

  try {
    localStorage.setItem(VERSION_KEY, current);
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }

  return previous !== null && previous !== current ? current : null;
}
