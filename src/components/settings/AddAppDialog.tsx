/**
 * @deprecated Orphan component — not currently imported by any parent component.
 * Previously used in ExcludedAppsSection but superseded by AppProfileAssignDialog.
 * Remove or wire into the App Profiles flow when ready.
 */
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
import { tauri, type ProcessInfo } from "@/lib/tauri";
import { Plus } from "lucide-react";

interface Props {
  excludedNames: string[];
  onAdd: (name: string) => void;
}

export function AddAppDialog({ excludedNames, onAdd }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualName, setManualName] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tauri
      .listRunningProcesses()
      .then(setProcesses)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [open]);

  const lowerExcluded = useMemo(
    () => new Set(excludedNames.map((n) => n.toLowerCase())),
    [excludedNames],
  );

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return processes.filter((p) => {
      if (lowerExcluded.has(p.name.toLowerCase())) return false;
      if (!f) return true;
      return (
        p.name.toLowerCase().includes(f) ||
        p.window_title.toLowerCase().includes(f)
      );
    });
  }, [processes, filter, lowerExcluded]);

  const submitManual = () => {
    const name = manualName.trim();
    if (!name) return;
    onAdd(name);
    setManualName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {t("excluded.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("excluded.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("excluded.dialog.desc")}
          </DialogDescription>
        </DialogHeader>

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
                    onClick={() => {
                      onAdd(p.name);
                      setOpen(false);
                    }}
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
