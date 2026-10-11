// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  MILESTONE_DAYS,
  MILESTONE_SESSIONS,
  NUDGE_COOLDOWN_MS,
  STORAGE_KEY,
  canPersistNudgePrefs,
  evaluateNudge,
  loadNudgePrefs,
  markNudgeShown,
  muteNudgeForever,
  type NudgePrefs,
} from "./donateNudge";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

const freshPrefs: NudgePrefs = { lastNudgeAt: null, mutedForever: false };

function stats(overrides: Partial<{ firstSeenAt: number; sessionCount: number }> = {}) {
  return { firstSeenAt: NOW - 365 * DAY_MS, sessionCount: 999, ...overrides };
}

function nudge(
  reason: "milestone" | "update",
  overrides: {
    stats?: Partial<{ firstSeenAt: number; sessionCount: number }>;
    prefs?: NudgePrefs;
    now?: number;
  } = {},
) {
  return evaluateNudge({
    reason,
    stats: stats(overrides.stats),
    prefs: overrides.prefs ?? freshPrefs,
    now: overrides.now ?? NOW,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("evaluateNudge — mute", () => {
  it("never nudges once the user chose \"don't ask again\"", () => {
    expect(nudge("milestone", { prefs: { lastNudgeAt: null, mutedForever: true } })).toBe(false);
    expect(nudge("update", { prefs: { lastNudgeAt: null, mutedForever: true } })).toBe(false);
  });
});

describe("evaluateNudge — cooldown", () => {
  it("blocks a second nudge inside the cooldown window", () => {
    const prefs = { lastNudgeAt: NOW - NUDGE_COOLDOWN_MS + 1, mutedForever: false };
    expect(nudge("update", { prefs })).toBe(false);
  });

  it("allows a nudge once the cooldown has elapsed", () => {
    const prefs = { lastNudgeAt: NOW - NUDGE_COOLDOWN_MS - 1, mutedForever: false };
    expect(nudge("update", { prefs })).toBe(true);
  });
});

describe("evaluateNudge — update reason", () => {
  it("fires right after a successful update", () => {
    expect(nudge("update")).toBe(true);
  });
});

describe("evaluateNudge — milestone reason", () => {
  it("fires once the user has been around for 30 days", () => {
    expect(nudge("milestone", { stats: { firstSeenAt: NOW - MILESTONE_DAYS * DAY_MS } })).toBe(
      true,
    );
  });

  it("fires once the user has opened the app 100 times", () => {
    expect(
      nudge("milestone", { stats: { firstSeenAt: NOW - DAY_MS, sessionCount: MILESTONE_SESSIONS } }),
    ).toBe(true);
  });

  it("stays quiet for a brand-new user", () => {
    expect(
      nudge("milestone", { stats: { firstSeenAt: NOW - DAY_MS, sessionCount: 1 } }),
    ).toBe(false);
  });
});

describe("nudge preferences persistence", () => {
  it("round-trips through localStorage", () => {
    markNudgeShown(NOW);
    expect(loadNudgePrefs()).toEqual({ lastNudgeAt: NOW, mutedForever: false });

    muteNudgeForever();
    expect(loadNudgePrefs()).toEqual({ lastNudgeAt: NOW, mutedForever: true });
  });

  it("returns defaults when storage is empty or corrupt", () => {
    expect(loadNudgePrefs()).toEqual(freshPrefs);

    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadNudgePrefs()).toEqual(freshPrefs);
  });

  it("falls back to defaults when a field has the wrong type", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lastNudgeAt: "yesterday", mutedForever: "no" }),
    );
    expect(loadNudgePrefs()).toEqual(freshPrefs);
  });

  it("keeps the cooldown when only the other field is corrupt", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lastNudgeAt: NOW, mutedForever: "no" }),
    );
    expect(loadNudgePrefs()).toEqual({ lastNudgeAt: NOW, mutedForever: false });
  });
});

describe("canPersistNudgePrefs", () => {
  it("reports true when localStorage accepts a write", () => {
    expect(canPersistNudgePrefs()).toBe(true);
  });

  it("reports false when localStorage rejects writes", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(canPersistNudgePrefs()).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
