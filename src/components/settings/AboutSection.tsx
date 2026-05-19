import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  checkForUpdate,
  downloadAndInstall,
  restartApp,
  type UpdateCheckResult,
  type InstallProgress,
} from "@/lib/updater";

type UiState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; result: Extract<UpdateCheckResult, { state: "available" }> }
  | { kind: "downloading"; progress: InstallProgress }
  | { kind: "ready-to-restart" }
  | { kind: "error"; message: string };

export function AboutSection() {
  const { t } = useTranslation();
  const reload = useSettingsStore((s) => s.load);
  const [version, setVersion] = useState<string>("");
  const [ui, setUi] = useState<UiState>({ kind: "idle" });

  useEffect(() => {
    tauri.appVersion().then(setVersion);
  }, []);

  const onCheck = async () => {
    setUi({ kind: "checking" });
    const result = await checkForUpdate();
    if (result.state === "up-to-date") {
      setUi({ kind: "up-to-date" });
    } else if (result.state === "available") {
      setUi({ kind: "available", result });
    } else {
      setUi({ kind: "error", message: result.message });
    }
  };

  const onInstall = async () => {
    if (ui.kind !== "available") return;
    setUi({ kind: "downloading", progress: { downloaded: 0, total: null, done: false } });
    try {
      await downloadAndInstall(ui.result.update, (progress) => {
        setUi({ kind: "downloading", progress });
      });
      setUi({ kind: "ready-to-restart" });
    } catch (e) {
      setUi({ kind: "error", message: String(e) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.about")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.version")}</span>
          <span className="font-medium tabular-nums">{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.author")}</span>
          <a
            href="https://github.com/quangtruong2003"
            onClick={(e) => {
              e.preventDefault();
              void open("https://github.com/quangtruong2003");
            }}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            Nguyễn Quang Trường
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.homepage")}</span>
          <a
            href={t("about.homepage_url")}
            onClick={(e) => {
              e.preventDefault();
              void open(t("about.homepage_url"));
            }}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            github.com/…
          </a>
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("about.updates")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onCheck}
              disabled={ui.kind === "checking" || ui.kind === "downloading"}
            >
              {ui.kind === "checking" ? t("about.checking") : t("about.check_now")}
            </Button>
          </div>
          {ui.kind === "up-to-date" && (
            <p className="text-xs text-muted-foreground">{t("about.up_to_date")}</p>
          )}
          {ui.kind === "available" && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-xs">
                {t("about.update_available", { version: ui.result.newVersion })}
              </span>
              <Button size="sm" onClick={onInstall}>
                {t("about.install_now")}
              </Button>
            </div>
          )}
          {ui.kind === "downloading" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("about.downloading", {
                  pct:
                    ui.progress.total && ui.progress.total > 0
                      ? Math.round((ui.progress.downloaded / ui.progress.total) * 100)
                      : 0,
                })}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      ui.progress.total && ui.progress.total > 0
                        ? `${(ui.progress.downloaded / ui.progress.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}
          {ui.kind === "ready-to-restart" && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-xs">{t("about.ready_to_restart")}</span>
              <Button size="sm" onClick={() => restartApp()}>
                {t("about.restart_now")}
              </Button>
            </div>
          )}
          {ui.kind === "error" && (
            <p className="text-xs text-destructive">{ui.message}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => tauri.openLogDir()}>
          {t("about.open_logs")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await tauri.resetOnboarding();
            await reload();
          }}
        >
          {t("about.rerun_setup")}
        </Button>
      </CardContent>
    </Card>
  );
}
