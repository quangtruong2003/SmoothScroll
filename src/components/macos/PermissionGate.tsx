import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { tauri } from "@/lib/tauri";
import { Button } from "@/components/ui/button";

type GateStatus = "idle" | "polling" | "checking" | "denied";

export function PermissionGate({ onGranted }: { onGranted: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GateStatus>("idle");

  // Active polling with backoff. Once user clicks "Request permission" we
  // poll quickly first, then back off to keep CPU low if the user takes a
  // while in System Settings.
  useEffect(() => {
    if (status !== "polling") return;
    let attempts = 0;
    let timer: number | null = null;
    const tick = async () => {
      attempts += 1;
      const ok = await tauri.accessibilityStatus().catch(() => false);
      if (ok) {
        onGranted();
        return;
      }
      const delay = attempts < 6 ? 800 : attempts < 20 ? 2000 : 5000;
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, 500);
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [status, onGranted]);

  const requestPrompt = useCallback(async () => {
    await tauri.accessibilityRequestPrompt().catch(() => false);
    setStatus("polling");
  }, []);

  const checkNow = useCallback(async () => {
    setStatus("checking");
    const ok = await tauri.accessibilityStatus().catch(() => false);
    if (ok) {
      onGranted();
      return;
    }
    setStatus("denied");
    window.setTimeout(() => setStatus((s) => (s === "denied" ? "polling" : s)), 1500);
  }, [onGranted]);

  return (
    <div className="container max-w-md py-12 space-y-4">
      <h1 className="text-2xl font-semibold">
        {t("permission.title", "Accessibility access required")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "permission.body",
          "SmoothScroll needs Accessibility permission to capture mouse-wheel events and re-emit them with smooth animation. Open System Settings → Privacy & Security → Accessibility and toggle SmoothScroll on.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={requestPrompt}>
          {t("permission.open", "Request permission")}
        </Button>
        <Button
          variant="outline"
          onClick={checkNow}
          disabled={status === "checking"}
        >
          {status === "checking"
            ? t("permission.checking", "Checking…")
            : t("permission.check_now", "I just granted it — check now")}
        </Button>
      </div>
      {status === "denied" && (
        <p className="text-xs text-destructive" role="status" aria-live="polite">
          {t(
            "permission.still_denied",
            "Still not granted. Make sure SmoothScroll is toggled ON in System Settings.",
          )}
        </p>
      )}
      {status === "polling" && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          <span
            aria-hidden
            className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle"
          />
          {t(
            "permission.polling",
            "Watching for permission. I'll continue automatically once granted.",
          )}
        </p>
      )}
    </div>
  );
}
