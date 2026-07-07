import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tauri, type MonitorInfo, type MonitorProfileEntry } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

function MonitorProfilesInner() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    tauri.listMonitors().then(setMonitors).catch(() => {
      // ignore
    });
  }, []);

  if (!settings) return null;

  // Only show on Windows (monitors list is empty on other platforms)
  const isLinux = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
  if (isLinux || monitors.length === 0) return null;

  const profiles = settings.profiles;
  const monitorProfiles = settings.monitor_profiles;

  const handleChange = (deviceName: string, friendlyName: string, profileId: string) => {
    const existing = monitorProfiles.findIndex((mp) => mp.device_name === deviceName);
    let updated: MonitorProfileEntry[];
    if (profileId === "__global__") {
      // Remove the entry — use global defaults
      updated = monitorProfiles.filter((mp) => mp.device_name !== deviceName);
    } else {
      const entry: MonitorProfileEntry = {
        device_name: deviceName,
        friendly_name: friendlyName,
        profile_id: profileId,
      };
      if (existing >= 0) {
        updated = monitorProfiles.map((mp) =>
          mp.device_name === deviceName ? entry : mp
        );
      } else {
        updated = [...monitorProfiles, entry];
      }
    }
    patch({ monitor_profiles: updated });
  };

  const currentValue = (deviceName: string): string => {
    const mp = monitorProfiles.find((m) => m.device_name === deviceName);
    if (!mp) return "__global__";
    return mp.profile_id;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.monitor_profiles")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <p className="text-xs text-muted-foreground pb-3">
          {t("monitor_profiles.description")}
        </p>
        {monitors.map((monitor) => (
          <div
            key={monitor.device_name}
            className="flex items-center justify-between gap-6 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {monitor.friendly_name || monitor.device_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {monitor.rect.right - monitor.rect.left}x{monitor.rect.bottom - monitor.rect.top}
              </p>
            </div>
            <Select
              value={currentValue(monitor.device_name)}
              onValueChange={(v) => handleChange(monitor.device_name, monitor.friendly_name, v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">
                  {t("monitor_profiles.global_default")}
                </SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export const MonitorProfiles = memo(MonitorProfilesInner);
