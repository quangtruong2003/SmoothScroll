import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";
import {
  downloadAndInstall,
  restartApp,
  type InstallProgress,
} from "@/lib/updater";

interface ForcedUpdateModalProps {
  update: Update;
  currentVersion: string;
  canSkip?: boolean;
  onSkip?: () => void;
}

type ModalState =
  | { kind: "idle" }
  | { kind: "downloading"; progress: InstallProgress }
  | { kind: "installed" }
  | { kind: "error"; message: string };

export function ForcedUpdateModal({ update, currentVersion, canSkip, onSkip }: ForcedUpdateModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ModalState>({ kind: "idle" });

  const onInstall = async () => {
    setState({
      kind: "downloading",
      progress: { downloaded: 0, total: null, done: false },
    });
    try {
      await downloadAndInstall(update, (p) => {
        setState({ kind: "downloading", progress: p });
      });
      setState({ kind: "installed" });
      await restartApp();
    } catch (e) {
      setState({ kind: "error", message: String(e) });
    }
  };

  const onQuit = () => {
    void tauri.quitApp();
  };

  const isDownloading = state.kind === "downloading";
  const isInstalled = state.kind === "installed";
  const isBusy = isDownloading || isInstalled;

  const pct =
    state.kind === "downloading" && state.progress.total && state.progress.total > 0
      ? Math.round((state.progress.downloaded / state.progress.total) * 100)
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forced-update-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg">
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <h2
              id="forced-update-title"
              className="text-lg font-semibold leading-none tracking-tight"
            >
              {t("forced_update.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("forced_update.description", {
                current: currentVersion || t("forced_update.unknown_version"),
                latest: update.version,
              })}
            </p>
          </div>

          {update.body && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("forced_update.notes_heading")}
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {update.body}
              </div>
            </div>
          )}

          {state.kind === "downloading" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("forced_update.downloading", { pct })}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {state.kind === "installed" && (
            <p className="text-sm text-primary">{t("forced_update.restarting")}</p>
          )}

          {state.kind === "error" && (
            <p className="text-sm text-destructive">
              {t("forced_update.error", { message: state.message })}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={onInstall} disabled={isBusy}>
                {isDownloading
                  ? t("forced_update.downloading_btn")
                  : isInstalled
                    ? t("forced_update.installed_btn")
                    : t("forced_update.install")}
              </Button>
              <Button variant="outline" onClick={onQuit} disabled={isBusy}>
                {t("forced_update.quit")}
              </Button>
            </div>
            {canSkip && onSkip && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={onSkip}
                disabled={isBusy}
              >
                {t("forced_update.skip")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
