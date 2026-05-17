import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/components/ui/toast";
import { ProfileEditor } from "./ProfileEditor";
import type { ScrollProfile } from "@/lib/tauri";

export function ProfilesSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const createProfile = useSettingsStore((s) => s.createProfile);
  const deleteProfile = useSettingsStore((s) => s.deleteProfile);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<ScrollProfile | null>(null);

  if (!settings) return null;

  const profiles = settings.profiles;
  const appProfiles = settings.app_profiles;

  const usageCount = (profileId: string) =>
    Object.values(appProfiles).filter((id) => id === profileId).length;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const profile = await createProfile(name);
      toast.success(t("profiles.created", { name: profile.name }));
      setNewName("");
      setCreateOpen(false);
      setEditing(profile);
    } catch (e) {
      toast.error(t("errors.profile_create_failed"));
    }
  };

  const handleDelete = async (profile: ScrollProfile) => {
    const usage = usageCount(profile.id);
    if (usage > 0) {
      toast.error(t("errors.profile_in_use", { count: usage }));
      return;
    }
    if (!confirm(t("profiles.delete_confirm", { name: profile.name }))) return;
    try {
      await deleteProfile(profile.id);
      toast.success(t("profiles.deleted", { name: profile.name }));
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("section.profiles")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t("profiles.description")}
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                {t("profiles.create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("profiles.create_dialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("profiles.create_dialog.desc")}
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder={t("profiles.create_dialog.placeholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  {t("profiles.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("profiles.empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {profiles.map((profile) => {
                const usage = usageCount(profile.id);
                return (
                  <li
                    key={profile.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {usage > 0
                          ? t("profiles.assigned_to", { count: usage })
                          : t("profiles.unassigned")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("profiles.edit_aria", { name: profile.name })}
                        onClick={() => setEditing(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("profiles.delete_aria", { name: profile.name })}
                        onClick={() => handleDelete(profile)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ProfileEditor
          profile={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
