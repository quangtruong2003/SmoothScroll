import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { tauri } from "@/lib/tauri";
import { IS_LINUX, IS_MAC } from "@/lib/platform";
import { Button } from "@/components/ui/button";

type GateStatus = "idle" | "polling" | "checking" | "denied";

interface PlatformStatus {
  accessible: boolean;
  flatpak: boolean;
  session_type: string;
  error_message: string | null;
}

export function PermissionGate({ onGranted }: { onGranted: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GateStatus>("idle");
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);

  useEffect(() => {
    if (IS_LINUX) {
      invoke<PlatformStatus>("get_platform_status")
        .then(setPlatformStatus)
        .catch(() => {
          // ignore errors, platformStatus stays null
        });
    }
  }, []);

  // macOS: active polling with backoff
  useEffect(() => {
    if (!IS_MAC || status !== "polling") return;
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

  // Linux permission error display
  if (IS_LINUX && platformStatus && !platformStatus.accessible) {
    return (
      <div className="container max-w-md py-12 space-y-4">
        <h1 className="text-2xl font-semibold">
          {platformStatus.flatpak
            ? t("permission.linux_flatpak_title", "SmoothScroll does not support Flatpak")
            : t("permission.linux_uinput_title", "Permission access required")}
        </h1>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded">
          {platformStatus.error_message || t("permission.linux_uinput_body")}
        </p>
        <p className="text-xs text-muted-foreground">
          {platformStatus.flatpak
            ? t("permission.linux_flatpak_hint", "Please install SmoothScroll from .deb or .AppImage instead.")
            : t("permission.linux_uinput_hint", "After running the commands above, log out and back in, then restart SmoothScroll.")}
        </p>
      </div>
    );
  }

  // macOS permission gate
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
