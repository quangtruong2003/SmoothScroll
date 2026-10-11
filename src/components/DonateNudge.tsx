import { useEffect, useState } from "react";
import { DonateNudgeDialog } from "@/components/DonateNudgeDialog";
import { tauri } from "@/lib/tauri";
import { loadStats } from "@/lib/localStats";
import {
  canPersistNudgePrefs,
  evaluateNudge,
  loadNudgePrefs,
  markNudgeShown,
  muteNudgeForever,
  type NudgeReason,
} from "@/lib/donateNudge";
import { detectFreshVersion } from "@/lib/appVersion";

const WHATSNEW_SELECTOR = "[data-whatsnew]";
const WHATSNEW_WAIT_INTERVAL_MS = 200;
const WHATSNEW_WAIT_TIMEOUT_MS = 30_000;

/**
 * WhatsNewModal owns the first moments after an update — both surfaces trigger
 * on the same version change, so showing the nudge at the same time would stack
 * two modals on the user. Wait for WhatsNew to clear before asking for coffee.
 */
async function waitForWhatsNewToClear(): Promise<void> {
  const deadline = Date.now() + WHATSNEW_WAIT_TIMEOUT_MS;
  while (document.querySelector(WHATSNEW_SELECTOR)) {
    if (Date.now() >= deadline) return;
    await new Promise((resolve) => setTimeout(resolve, WHATSNEW_WAIT_INTERVAL_MS));
  }
}

/**
 * Decides whether this session should show the donate nudge, and hosts the
 * dialog when it should. Best-effort: any failure leaves the app alone.
 */
export function DonateNudge() {
  const [nudge, setNudge] = useState<{ reason: NudgeReason; version?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [trusted, freshVersion] = await Promise.all([
          tauri.isTrustedDevice(),
          detectFreshVersion(() => tauri.appVersion()),
        ]);
        if (cancelled || trusted) return;

        const reason: NudgeReason = freshVersion ? "update" : "milestone";
        const show = evaluateNudge({
          reason,
          stats: loadStats(),
          prefs: loadNudgePrefs(),
          now: Date.now(),
        });
        if (!show) return;

        // A choice we cannot store is a choice we have no right to override.
        if (!canPersistNudgePrefs()) return;

        if (reason === "update") {
          await waitForWhatsNewToClear();
          if (cancelled) return;
        }

        setNudge({ reason, version: freshVersion ?? undefined });
      } catch {
        // Nudge is best-effort — never let it interrupt boot.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!nudge) return null;

  return (
    <DonateNudgeDialog
      open
      reason={nudge.reason}
      version={nudge.version}
      onClose={() => {
        markNudgeShown(Date.now());
        setNudge(null);
      }}
      onMuteForever={() => {
        muteNudgeForever();
        setNudge(null);
      }}
    />
  );
}
