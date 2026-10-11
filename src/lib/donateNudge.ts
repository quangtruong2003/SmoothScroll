/**
 * Event-triggered "buy me a coffee" nudge.
 *
 * Pure decision logic plus localStorage prefs. Zero network, zero telemetry —
 * the same privacy posture as `localStats.ts`.
 */

export const STORAGE_KEY = "ss.donateNudge.v1";
export const NUDGE_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
export const MILESTONE_DAYS = 30;
export const MILESTONE_SESSIONS = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeReason = "milestone" | "update";

export interface NudgePrefs {
  lastNudgeAt: number | null;
  mutedForever: boolean;
}

export interface NudgeStats {
  firstSeenAt: number;
  sessionCount: number;
}

export const DEFAULT_PREFS: NudgePrefs = { lastNudgeAt: null, mutedForever: false };

export function loadNudgePrefs(): NudgePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NudgePrefs>;
    return {
      // A wrong-typed field must not survive: `now - "yesterday"` is NaN, and
      // `NaN < COOLDOWN` is false, which would silently bypass the cooldown.
      lastNudgeAt: typeof parsed.lastNudgeAt === "number" ? parsed.lastNudgeAt : null,
      mutedForever: parsed.mutedForever === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Whether the user's "later" / "don't ask again" choice can actually be
 * remembered. If writes fail (quota, locked-down profile) we must not nudge at
 * all — a choice we cannot store is a choice we have no right to override.
 */
export function canPersistNudgePrefs(): boolean {
  try {
    const probe = `${STORAGE_KEY}.probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function saveNudgePrefs(prefs: NudgePrefs): NudgePrefs {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
  return prefs;
}

export function markNudgeShown(now: number): NudgePrefs {
  return saveNudgePrefs({ ...loadNudgePrefs(), lastNudgeAt: now });
}

export function muteNudgeForever(): NudgePrefs {
  return saveNudgePrefs({ ...loadNudgePrefs(), mutedForever: true });
}

export function evaluateNudge({
  reason,
  stats,
  prefs,
  now,
}: {
  reason: NudgeReason;
  stats: NudgeStats;
  prefs: NudgePrefs;
  now: number;
}): boolean {
  if (prefs.mutedForever) return false;
  if (prefs.lastNudgeAt !== null && now - prefs.lastNudgeAt < NUDGE_COOLDOWN_MS) {
    return false;
  }
  if (reason === "update") return true;
  return (
    now - stats.firstSeenAt >= MILESTONE_DAYS * DAY_MS ||
    stats.sessionCount >= MILESTONE_SESSIONS
  );
}
