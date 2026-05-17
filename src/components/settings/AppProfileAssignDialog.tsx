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
import { tauri, type ProcessInfo } from "@/lib/tauri";
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
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(DISABLED_PROFILE_ID);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tauri
      .listRunningProcesses()
      .then(setProcesses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

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
