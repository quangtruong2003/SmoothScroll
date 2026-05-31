import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tauri } from "@/lib/tauri";
import type { RespectReduceMotion } from "@/lib/tauri";
import { useSettingsStore, useBehaviorFields } from "@/stores/settingsStore";
import { HotkeyRecorderInput } from "@/components/HotkeyRecorderInput";
import { SettingRow } from "./SettingRow";
import { toast } from "@/components/ui/toast";

function BehaviorSectionInner() {
  const { t } = useTranslation();
  const fields = useBehaviorFields();
  const patch = useSettingsStore((s) => s.patch);
  const [autostart, setAutostartState] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [osReduceMotion, setOsReduceMotion] = useState<boolean>(false);

  useEffect(() => {
    tauri.getAutostart().then(setAutostartState);
  }, []);

  useEffect(() => {
    void tauri.getReduceMotionStatus().then(setOsReduceMotion).catch(() => {
      // ignore
    });
    const un = listen<boolean>("reduce-motion-changed", (e) => {
      setOsReduceMotion(Boolean(e.payload));
    });
    return () => {
      un.then((u) => u()).catch(() => {
        // ignore
      });
    };
  }, []);

  if (!fields) return null;

  const onAutostart = async (next: boolean) => {
    try {
      await tauri.setAutostart(next);
      setAutostartState(next);
    } catch {
      toast.error(t("errors.autostart_failed"));
    }
  };

  const onHotkeyEnabledChange = async (next: boolean) => {
    setHotkeyError(null);
    patch({ enable_global_hotkey: next });
    try {
      await tauri.setHotkeyEnabled(next);
    } catch {
      toast.error(t("errors.hotkey_toggle_failed"));
      patch({ enable_global_hotkey: !next });
    }
  };

  const onHotkeyCommit = async (accel: string) => {
    setHotkeyError(null);
    const previous = fields.hotkey_accelerator;
    patch({ hotkey_accelerator: accel });
    try {
      await tauri.setHotkeyAccelerator(accel);
      toast.success(t("settings.hotkey_accelerator.saved"));
    } catch {
      toast.error(t("errors.hotkey_save_failed"));
      patch({ hotkey_accelerator: previous });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.behavior")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <SettingRow
          htmlFor="hotkey-toggle"
          title={t("settings.global_hotkey.title")}
          description={t("settings.global_hotkey.desc")}
        >
          <Switch
            id="hotkey-toggle"
            checked={fields.enable_global_hotkey}
            onCheckedChange={onHotkeyEnabledChange}
          />
        </SettingRow>

        <SettingRow
          htmlFor="hotkey-accel"
          title={t("settings.hotkey_accelerator.title")}
          description={t("settings.hotkey_accelerator.desc")}
        >
          <div className="flex flex-col items-end gap-1">
            <HotkeyRecorderInput
              value={fields.hotkey_accelerator}
              onCommit={onHotkeyCommit}
              disabled={!fields.enable_global_hotkey}
            />
            {hotkeyError && (
              <span className="text-xs text-destructive max-w-[12rem] text-right">
                {hotkeyError}
              </span>
            )}
          </div>
        </SettingRow>

        <SettingRow
          htmlFor="autostart"
          title={t("settings.start_with_os.title")}
          description={t("settings.start_with_os.desc")}
        >
          <Switch
            id="autostart"
            checked={autostart}
            onCheckedChange={onAutostart}
          />
        </SettingRow>

        <SettingRow
          htmlFor="start-minimized"
          title={t("settings.start_minimized.title")}
          description={t("settings.start_minimized.desc")}
        >
          <Switch
            id="start-minimized"
            checked={fields.start_minimized}
            onCheckedChange={(v) => patch({ start_minimized: v })}
          />
        </SettingRow>

        <SettingRow
          htmlFor="reduce-motion"
          title={t("settings.reduce_motion.title")}
          description={t("settings.reduce_motion.desc")}
        >
          <Select
            value={fields.respect_reduce_motion ?? "Auto"}
            onValueChange={(v) =>
              patch({ respect_reduce_motion: v as RespectReduceMotion })
            }
          >
            <SelectTrigger id="reduce-motion" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Auto">
                {t("settings.reduce_motion.auto")}
              </SelectItem>
              <SelectItem value="Always">
                {t("settings.reduce_motion.always")}
              </SelectItem>
              <SelectItem value="Never">
                {t("settings.reduce_motion.never")}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <div className="text-xs text-muted-foreground py-2">
          {osReduceMotion
            ? t("settings.reduce_motion.status_on")
            : t("settings.reduce_motion.status_off")}
        </div>
      </CardContent>
    </Card>
  );
}

export const BehaviorSection = memo(BehaviorSectionInner);
