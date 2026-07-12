import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { tauri } from "@/lib/tauri";
import { IS_LINUX, IS_MAC } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (IS_LINUX) {
      invoke<PlatformStatus>("get_platform_status")
        .then((s) => {
          setPlatformStatus(s);
          // If already accessible, grant immediately
          if (s.accessible) {
            onGranted();
          }
        })
        .catch(() => {
          // On error, assume we need to show the gate
          setPlatformStatus({
            accessible: false,
            flatpak: false,
            session_type: "unknown",
            error_message: t("permission.platform_error"),
          });
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // macOS: active polling with backoff
  useEffect(() => {
    if (!IS_MAC || status !== "polling") return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      attempts += 1;
      const ok = await tauri.accessibilityStatus().catch(() => false);
      if (ok) {
        onGranted();
        return;
      }
      const delay = attempts < 6 ? 800 : attempts < 20 ? 2000 : 5000;
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 500);
    return () => {
      if (timer != null) clearTimeout(timer);
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
    setTimeout(() => setStatus((s) => (s === "denied" ? "polling" : s)), 1500);
  }, [onGranted]);

  const retryLinux = useCallback(async () => {
    setIsLoading(true);
    try {
      const s = await invoke<PlatformStatus>("get_platform_status");
      setPlatformStatus(s);
      if (s.accessible) {
        onGranted();
      }
    } catch {
      setPlatformStatus({
        accessible: false,
        flatpak: false,
        session_type: "unknown",
        error_message: t("permission.platform_error"),
      });
    } finally {
      setIsLoading(false);
    }
  }, [onGranted]);

  // Loading state
  if (isLoading) {
    return (
      <div className="permission-loading native-permission-loading container max-w-md py-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {IS_LINUX
            ? t("permission.linux_checking")
            : t("permission.checking")}
        </p>
      </div>
    );
  }

  // Linux permission error display
  if (IS_LINUX && platformStatus && !platformStatus.accessible) {
    const isFlatpak = platformStatus.flatpak;
    const errorMsg = platformStatus.error_message || "";

    return (
      <div className="permission-error native-permission-error container max-w-md py-8 space-y-6">
        {/* Header */}
        <div className="permission-error-header flex items-center gap-3">
          <div className={`permission-error-badge ${isFlatpak ? 'permission-error-badge-flatpak' : 'permission-error-badge-generic'}`}>
            <AlertTriangle className={`h-6 w-6 ${isFlatpak ? 'permission-error-icon-flatpak' : 'permission-error-icon-generic'}`} />
          </div>
          <div>
            <h1 className="permission-error-title text-xl font-semibold">
              {isFlatpak
                ? t("permission.linux_flatpak_title")
                : t("permission.linux_uinput_title")}
            </h1>
            <p className="permission-error-subtitle text-sm text-muted-foreground">
              {isFlatpak
                ? t("permission.linux_flatpak_subtitle")
                : platformStatus.session_type === "wayland"
                  ? t("permission.linux_wayland_subtitle")
                  : t("permission.linux_x11_subtitle")}
            </p>
          </div>
        </div>

        {/* Error details */}
        <div className="space-y-3">
          <pre className="permission-error-pre text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg border overflow-x-auto">
            {errorMsg}
          </pre>

          {/* Session type indicator */}
          {!isFlatpak && (
            <div className="permission-session-indicator flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("permission.session_label")}</span>
              <code className="permission-session-code px-2 py-0.5 bg-muted rounded">
                {platformStatus.session_type || "unknown"}
              </code>
              {platformStatus.session_type === "wayland" && (
                <span className="text-amber-600 dark:text-amber-400">
                  {"⚠ " + t("permission.wayland_hint")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {!isFlatpak && (
            <>
              <Button onClick={retryLinux} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                {t("permission.linux_retry")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t("permission.linux_retry_hint")}
              </p>
            </>
          )}
          {isFlatpak && (
            <p className="text-sm text-muted-foreground">
              {t("permission.linux_flatpak_hint")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // macOS/Windows permission gate
  return (
    <div className="permission-container native-permission-container container max-w-md py-12 space-y-4">
      <div className="permission-header flex items-center gap-3">
        <div className="permission-badge p-2 rounded-full bg-blue-100 dark:bg-blue-950">
          <CheckCircle2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="permission-title text-xl font-semibold">
            {t("permission.title")}
          </h1>
          <p className="permission-subtitle text-sm text-muted-foreground">
            {IS_MAC
              ? t("permission.macos_subtitle")
              : t("permission.windows_subtitle")}
          </p>
        </div>
      </div>

      <p className="permission-body text-sm text-muted-foreground">
        {IS_MAC
          ? t("permission.macos_body")
          : t("permission.body")}
      </p>

      <div className="permission-actions flex flex-wrap gap-2">
        <Button onClick={requestPrompt}>
          {t("permission.open")}
        </Button>
        <Button
          variant="outline"
          onClick={checkNow}
          disabled={status === "checking"}
        >
          {status === "checking" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("permission.checking")}
            </>
          ) : (
            t("permission.check_now")
          )}
        </Button>
      </div>

      {status === "denied" && (
        <p className="permission-status-denied text-sm text-destructive flex items-center gap-2" role="status" aria-live="polite">
          <AlertTriangle className="h-4 w-4" />
          {t("permission.still_denied")}
        </p>
      )}
      {status === "polling" && (
        <div className="permission-status-polling flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("permission.polling")}
        </div>
      )}
    </div>
  );
}
