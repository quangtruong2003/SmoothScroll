import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useGameModeFields } from "@/stores/settingsStore";
import { tauri, type GameCatalogEntry } from "@/lib/tauri";
import { IS_LINUX } from "@/lib/platform";
import { gameIconFor } from "@/lib/gameIcons";
import { Gamepad2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

/** 16x16 chip icon: bundled asset -> backend-extracted -> generic fallback. */
function GameIcon({ name, iconUrl }: { name: string; iconUrl?: string | null }) {
  const src = gameIconFor(name) ?? (iconUrl ? `data:image/png;base64,${iconUrl}` : null);
  if (!src) {
    return <Gamepad2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <img src={src} alt="" className="h-4 w-4 shrink-0 rounded-sm" />;
}

function GameModeSectionInner() {
  const { t } = useTranslation();
  const fields = useGameModeFields();
  const patch = useSettingsStore((s) => s.patch);
  const [active, setActive] = useState(false);
  const [newGame, setNewGame] = useState("");
  const [backendIcons, setBackendIcons] = useState<Record<string, string | null>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState<GameCatalogEntry[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    tauri.getGameModeStatus().then(setActive);
    const unlistenPromise = listen<boolean>("game-mode-changed", (e) => setActive(e.payload));
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  // Icons for known games not covered by the bundled map. Backend caches by
  // name, so re-fetching after each add/remove is cheap.
  useEffect(() => {
    if (!fields) return;
    const need = fields.game_mode_known_apps.filter((n) => !gameIconFor(n));
    if (need.length === 0) return;
    let cancelled = false;
    tauri
      .getKnownGameIcons(need)
      .then((map) => {
        if (!cancelled) setBackendIcons((prev) => ({ ...prev, ...map }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fields?.game_mode_known_apps]);

  const knownApps = fields?.game_mode_known_apps ?? [];
  const knownLower = useMemo(
    () => new Set(knownApps.map((n) => n.toLowerCase())),
    [knownApps],
  );
  const filteredCatalog = useMemo(() => {
    const f = newGame.trim().toLowerCase();
    return (catalog ?? []).filter((c) => {
      if (knownLower.has(c.exe_name.toLowerCase())) return false;
      if (!f) return true;
      return (
        c.exe_name.toLowerCase().includes(f) ||
        (c.display_name ?? "").toLowerCase().includes(f)
      );
    });
  }, [catalog, newGame, knownLower]);

  if (!fields) return null;

  // Requests one small batch at a time, merging each response into state as
  // it lands, so icons pop in progressively instead of one long wait. Each
  // backend call only extracts cache misses, so later chunks are cheap.
  const fetchIconsInChunks = (names: string[]) => {
    if (names.length === 0) return;
    const CHUNK = 24;
    let index = 0;
    const next = (): Promise<void> => {
      const chunk = names.slice(index, index + CHUNK);
      index += chunk.length;
      if (chunk.length === 0) return Promise.resolve();
      return tauri
        .getKnownGameIcons(chunk)
        .then((map) => setBackendIcons((prev) => ({ ...prev, ...map })))
        .then(next);
    };
    next().catch(() => undefined);
  };

  const openPicker = () => {
    setPickerOpen(true);
    if (catalog || catalogLoading) return;
    setCatalogLoading(true);
    tauri
      .getGameCatalog()
      .then((entries) => {
        setCatalog(entries);
        // Picker rows show real icons too: bundled names are already covered
        // by gameIconFor, the rest is fetched in small sequential chunks so
        // the visible top of the list gets its icons first, without waiting
        // for the whole catalog's extraction pass.
        const need = entries
          .map((e) => e.exe_name)
          .filter((n) => !gameIconFor(n) && backendIcons[n] === undefined);
        fetchIconsInChunks(need);
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  };

  const addGame = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (fields.game_mode_known_apps.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
      setNewGame("");
      return;
    }
    await tauri.addKnownGame(trimmed);
    patch({ game_mode_known_apps: [...fields.game_mode_known_apps, trimmed] });
    setNewGame("");
    setPickerOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.game_mode")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t("game_mode.auto_disable")}</Label>
          <Switch
            checked={fields.game_mode_enabled}
            onCheckedChange={(v) => patch({ game_mode_enabled: v })}
          />
        </div>
        <div className={`rounded p-2 text-sm ${active ? "bg-orange-100 dark:bg-orange-950" : "bg-muted"}`}>
          {t("game_mode.status_label")}:{" "}
          {active ? t("game_mode.status_active") : t("game_mode.status_inactive")}
        </div>
        <div className="space-y-2">
          <Label>{t("game_mode.known_games")}</Label>
          <div className="flex flex-wrap gap-1">
            {fields.game_mode_known_apps.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-0.5 text-xs">
                <GameIcon name={g} iconUrl={backendIcons[g]} />
                {g}
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await tauri.removeKnownGame(g);
                    patch({ game_mode_known_apps: fields.game_mode_known_apps.filter((x) => x !== g) });
                  }}
                >×</button>
              </span>
            ))}
          </div>
          <Popover open={pickerOpen} onOpenChange={(o) => (o ? openPicker() : setPickerOpen(false))}>
            {/* Explicit type="text": Radix's PopoverTrigger Slot otherwise forces
                type="button" onto the input, which makes it uneditable (React's
                change plugin ignores input events for non-text types). */}
            <PopoverTrigger asChild>
              <Input
                type="text"
                placeholder={IS_LINUX ? 'steam' : t("game_mode.search_placeholder")}
                value={newGame}
                onChange={(e) => setNewGame(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addGame(newGame);
                  }
                }}
              />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <ScrollArea className="h-64">
                <div data-testid="game-picker-list">
                  {catalogLoading ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("game_mode.loading")}
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {t("game_mode.empty_state")}
                    </div>
                  ) : (
                    filteredCatalog.map((c) => (
                      <button
                        key={c.exe_name}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                        onClick={() => void addGame(c.exe_name)}
                      >
                        <GameIcon name={c.exe_name} iconUrl={backendIcons[c.exe_name]} />
                        <span className="font-medium">{c.exe_name}</span>
                        {c.display_name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {c.display_name}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}

export const GameModeSection = memo(GameModeSectionInner);
