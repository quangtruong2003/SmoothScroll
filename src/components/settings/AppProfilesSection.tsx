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
import { AppProfileAssignDialog } from "./AppProfileAssignDialog";
import { toast } from "@/components/ui/toast";

const DISABLED_PROFILE_ID = "__disabled__";

export function ExcludedAppsSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const assignAppProfile = useSettingsStore((s) => s.assignAppProfile);
  const unassignAppProfile = useSettingsStore((s) => s.unassignAppProfile);

  if (!settings) return null;

  const appProfiles = settings.app_profiles;
  const profiles = settings.profiles;
  const assignedNames = Object.keys(appProfiles);

  const profileLabel = (profileId: string): string => {
    if (profileId === DISABLED_PROFILE_ID) return t("app_profiles.disabled");
    const profile = profiles.find((p) => p.id === profileId);
    return profile?.name ?? t("app_profiles.unknown_profile");
  };

  const handleAssign = async (name: string, profileId: string) => {
    try {
      await assignAppProfile(name, profileId);
      toast.success(t("app_profiles.assigned", { name, profile: profileLabel(profileId) }));
    } catch {
      toast.error(t("errors.app_profile_assign_failed"));
    }
  };

  const handleChangeProfile = async (name: string, profileId: string) => {
    try {
      await assignAppProfile(name, profileId);
      toast.success(t("app_profiles.assigned", { name, profile: profileLabel(profileId) }));
    } catch {
      toast.error(t("errors.app_profile_assign_failed"));
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await unassignAppProfile(name);
      toast.success(t("app_profiles.removed", { name }));
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
        {assignedNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("app_profiles.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {assignedNames.map((name) => {
              const currentProfileId = appProfiles[name];
              return (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="font-medium truncate flex-1">{name}</span>
                  <Select
                    value={currentProfileId}
                    onValueChange={(v) => handleChangeProfile(name, v)}
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
                    aria-label={t("app_profiles.remove_aria", { name })}
                    onClick={() => handleRemove(name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
