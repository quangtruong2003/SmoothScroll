import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri, type AppSettings } from "@/lib/tauri";

const REQUIRED_KEYS: readonly (keyof AppSettings)[] = [
  "step_size_px",
  "animation_time_ms",
  "max_velocity",
  "acceleration_max",
  "tail_to_head_ratio",
  "language",
  "theme",
];

function isValidSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return REQUIRED_KEYS.every((k) => k in obj);
}

type Status =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export function BackupSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const reload = useSettingsStore((s) => s.load);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const showStatus = (next: Status) => {
    setStatus(next);
    if (next.kind !== "idle") {
      window.setTimeout(() => setStatus({ kind: "idle" }), 4000);
    }
  };

  const onExport = () => {
    if (!settings) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smoothscroll-settings-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus({
      kind: "ok",
      message: t("backup.exported", "Settings exported successfully"),
    });
  };

  const onImportClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !window.confirm(
        t(
          "backup.confirm_import",
          "Import will overwrite your current settings. Continue?",
        ),
      )
    ) {
      return;
    }
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isValidSettings(parsed)) {
        throw new Error("invalid schema");
      }
      await tauri.saveSettings(parsed);
      await reload();
      showStatus({
        kind: "ok",
        message: t("backup.imported", "Settings imported. Reloading…"),
      });
    } catch {
      showStatus({
        kind: "error",
        message: t("backup.import_error"),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("backup.title", "Backup & restore")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {t(
            "backup.description",
            "Export your settings to a JSON file or restore from a backup. Useful when moving to a new machine.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!settings}
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {t("backup.export", "Export settings")}
          </Button>
          <Button variant="outline" size="sm" onClick={onImportClick}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            {t("backup.import", "Import settings")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>
        {status.kind === "ok" && (
          <p
            className="flex items-center gap-1.5 text-xs text-emerald-500"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p
            className="flex items-center gap-1.5 text-xs text-destructive"
            role="status"
            aria-live="polite"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {status.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
