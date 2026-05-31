import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tauri, type ProcessInfo, type ProfileSuggestion } from "@/lib/tauri";
import { Plus } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const DISABLED_PROFILE_ID = "__disabled__";

interface Props {
  alreadyAssignedNames: string[];
  onAssign: (name: string, profileId: string) => void;
}

export function AppProfileAssignDialog({ alreadyAssignedNames, onAssign }: Props) {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const createProfile = useSettingsStore((s) => s.createProfile);
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const assignAppProfile = useSettingsStore((s) => s.assignAppProfile);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(DISABLED_PROFILE_ID);
  const [suggestion, setSuggestion] = useState<ProfileSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tauri
      .listRunningProcesses()
      .then(setProcesses)
      .catch(() => {
        // ignore
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSuggestion(null);
      setShowSuggestion(true);
    }
  }, [open]);

  const selectedApp = manualName.trim();

  useEffect(() => {
    if (!selectedApp) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    tauri
      .suggestProfileForApp(selectedApp)
      .then((s) => {
        if (!cancelled) setSuggestion(s);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [selectedApp]);

  const lowerAssigned = useMemo(
    () => new Set(alreadyAssignedNames.map((n) => n.toLowerCase())),
    [alreadyAssignedNames],
  );

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return processes.filter((p) => {
      if (lowerAssigned.has(p.name.toLowerCase())) return false;
      if (!f) return true;
      return (
        p.name.toLowerCase().includes(f) ||
        p.window_title.toLowerCase().includes(f)
      );
    });
  }, [processes, filter, lowerAssigned]);

  const profiles = settings?.profiles ?? [];

  const handleAssign = (name: string) => {
    onAssign(name, selectedProfileId);
    setOpen(false);
    setManualName("");
  };

  const submitManual = () => {
    const name = manualName.trim();
    if (!name) return;
    handleAssign(name);
  };

  const handleUseSuggestion = async (s: ProfileSuggestion) => {
    if (!selectedApp) return;
    if (s.preset.kind === "Disabled") {
      await assignAppProfile(selectedApp, DISABLED_PROFILE_ID);
      setOpen(false);
      setManualName("");
      return;
    }
    const baseName = `${s.category_label} (auto)`;
    const newProfile = await createProfile(baseName);
    const merged: typeof newProfile = {
      ...newProfile,
      ...s.preset.data,
      id: newProfile.id,
      name: baseName,
    };
    await updateProfile(merged);
    await assignAppProfile(selectedApp, newProfile.id);
    setOpen(false);
    setManualName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {t("app_profiles.assign")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("app_profiles.dialog.title")}</DialogTitle>
          <DialogDescription>{t("app_profiles.dialog.desc")}</DialogDescription>
        </DialogHeader>

        {showSuggestion && suggestion && suggestion.category !== "Unknown" && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <div>
              <strong>
                {t("profiles.suggest.title", { category: suggestion.category_label })}:
              </strong>{" "}
              {suggestion.preset.kind === "Disabled"
                ? t("profiles.suggest.disable")
                : t("profiles.suggest.custom_preset", {
                    step: suggestion.preset.data.step_size_px,
                    ms: suggestion.preset.data.animation_time_ms,
                  })}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => handleUseSuggestion(suggestion)}>
                {t("profiles.suggest.use")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSuggestion(false)}
              >
                {t("profiles.suggest.pick_manually")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {t("app_profiles.dialog.select_profile")}
          </label>
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger>
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
        </div>

        <Input
          placeholder={t("excluded.dialog.filter")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <ScrollArea className="h-64 rounded-md border">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("excluded.dialog.scanning")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t("excluded.dialog.no_match")}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((p) => (
                <li key={`${p.pid}-${p.name}`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent"
                    onClick={() => handleAssign(p.name)}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.window_title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="flex items-center gap-2">
          <Input
            placeholder={t("excluded.dialog.manual")}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManual();
            }}
          />
          <Button onClick={submitManual} disabled={!manualName.trim()}>
            {t("excluded.dialog.manual_button")}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("excluded.dialog.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
