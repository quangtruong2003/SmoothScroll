import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";
import { AppProfileAssignDialog, type MonitorChoice } from "./AppProfileAssignDialog";
import { toast } from "@/components/ui/toast";

const DISABLED_PROFILE_ID = "__disabled__";

/** One row of the assignments list: an app-wide binding, or one scoped to a monitor. */
interface BindingRow {
  key: string;
  displayName: string;
  profileId: string;
  processName: string;
  monitor?: MonitorChoice;
}

export function ExcludedAppsSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const assignAppProfile = useSettingsStore((s) => s.assignAppProfile);
  const unassignAppProfile = useSettingsStore((s) => s.unassignAppProfile);

  if (!settings) return null;

  const appProfiles = settings.app_profiles;
  const profiles = settings.profiles;
  const assignedNames = Object.keys(appProfiles);

  // Per-monitor bindings live in a separate field and outrank app-wide ones,
  // so they need their own rows or they would be invisible and unremovable.
  const rows: BindingRow[] = [
    ...assignedNames.map((name) => ({
      key: name,
      displayName: name,
      profileId: appProfiles[name],
      processName: name,
      monitor: undefined,
    })),
    ...settings.app_monitor_profiles.map((binding) => ({
      // JSON-encoded so a process name containing spaces cannot collide with
      // a different (process, monitor) pair.
      key: JSON.stringify([binding.process_name, binding.device_name]),
      displayName: `${binding.process_name} · ${
        binding.friendly_name || binding.device_name
      }`,
      profileId: binding.profile_id,
      processName: binding.process_name,
      monitor: {
        deviceName: binding.device_name,
        friendlyName: binding.friendly_name || binding.device_name,
      },
    })),
  ];

  const profileLabel = (profileId: string): string => {
    if (profileId === DISABLED_PROFILE_ID) return t("app_profiles.disabled");
    const profile = profiles.find((p) => p.id === profileId);
    return profile?.name ?? t("app_profiles.unknown_profile");
  };

  const handleAssign = async (
    name: string,
    profileId: string,
    monitor?: MonitorChoice,
  ) => {
    const label = monitor ? `${name} · ${monitor.friendlyName}` : name;
    try {
      await assignAppProfile(name, profileId, monitor);
      toast.success(
        t("app_profiles.assigned", { name: label, profile: profileLabel(profileId) }),
      );
    } catch {
      toast.error(t("errors.app_profile_assign_failed"));
    }
  };

  const handleChangeProfile = async (row: BindingRow, profileId: string) => {
    try {
      await assignAppProfile(row.processName, profileId, row.monitor);
      toast.success(
        t("app_profiles.assigned", {
          name: row.displayName,
          profile: profileLabel(profileId),
        }),
      );
    } catch {
      toast.error(t("errors.app_profile_assign_failed"));
    }
  };

  const handleRemove = async (row: BindingRow) => {
    try {
      await unassignAppProfile(row.processName, row.monitor?.deviceName ?? null);
      toast.success(t("app_profiles.removed", { name: row.displayName }));
    } catch {
      toast.error(t("errors.app_profile_remove_failed"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("section.app_profiles")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("app_profiles.description")}
          </p>
        </div>
        <AppProfileAssignDialog
          alreadyAssignedNames={assignedNames}
          onAssign={handleAssign}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("app_profiles.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="font-medium truncate flex-1">
                  {row.monitor ? (
                    <>
                      {row.processName}{" "}
                      <span className="inline-block rounded border px-1.5 py-0.5 align-middle text-xs font-normal text-muted-foreground">
                        {row.monitor.friendlyName}
                      </span>
                    </>
                  ) : (
                    row.displayName
                  )}
                </span>
                <Select
                  value={row.profileId}
                  onValueChange={(v) => handleChangeProfile(row, v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DISABLED_PROFILE_ID}>
                      {t("app_profiles.disabled")}
                    </SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("app_profiles.remove_aria", { name: row.displayName })}
                  onClick={() => handleRemove(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
