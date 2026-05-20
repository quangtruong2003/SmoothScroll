/**
 * Local-only stats tracker. Counts user activity (scrolls, sessions, app
 * opens) entirely in localStorage — zero outbound network. Surfaces in the
 * About / Stats panel so users see "their" data without us seeing it.
 */

const KEY = "ss.stats.v1";

export interface LocalStats {
  totalScrolls: number;
  sessionCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

function defaultStats(): LocalStats {
  const now = Date.now();
  return {
    totalScrolls: 0,
    sessionCount: 0,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}

export function loadStats(): LocalStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw) as Partial<LocalStats>;
    return {
      totalScrolls: parsed.totalScrolls ?? 0,
      sessionCount: parsed.sessionCount ?? 0,
      firstSeenAt: parsed.firstSeenAt ?? Date.now(),
      lastSeenAt: parsed.lastSeenAt ?? Date.now(),
    };
  } catch {
    return defaultStats();
  }
}

export function saveStats(s: LocalStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
}

export function bumpSession(): LocalStats {
  const s = loadStats();
  const next: LocalStats = {
    ...s,
    sessionCount: s.sessionCount + 1,
    lastSeenAt: Date.now(),
  };
  saveStats(next);
  return next;
}

export function bumpScrolls(by: number): void {
  if (by <= 0) return;
  const s = loadStats();
  saveStats({
    ...s,
    totalScrolls: s.totalScrolls + by,
    lastSeenAt: Date.now(),
  });
}

export function resetStats(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
