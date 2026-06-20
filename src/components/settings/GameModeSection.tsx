import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore, useGameModeFields } from "@/stores/settingsStore";
import { tauri } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function GameModeSectionInner() {
  const { t } = useTranslation();
  const fields = useGameModeFields();
  const patch = useSettingsStore((s) => s.patch);
  const [active, setActive] = useState(false);
  const [newGame, setNewGame] = useState("");

  useEffect(() => {
    tauri.getGameModeStatus().then(setActive);
    const unlistenPromise = listen<boolean>("game-mode-changed", (e) => setActive(e.payload));
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  if (!fields) return null;

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
              <span key={g} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
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
          <div className="flex gap-2">
            <Input
              placeholder={/Linux/.test(navigator.userAgent) ? 'steam' : t("game_mode.placeholder")}
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!newGame.trim()) return;
                await tauri.addKnownGame(newGame);
                patch({ game_mode_known_apps: [...fields.game_mode_known_apps, newGame.trim()] });
                setNewGame("");
              }}
            >{t("common.add")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const GameModeSection = memo(GameModeSectionInner);
