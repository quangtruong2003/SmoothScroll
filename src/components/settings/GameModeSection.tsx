import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GameModeSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [active, setActive] = useState(false);
  const [newGame, setNewGame] = useState("");

  useEffect(() => {
    tauri.getGameModeStatus().then(setActive);
    const unlistenPromise = listen<boolean>("game-mode-changed", (e) => setActive(e.payload));
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game mode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Auto-disable in games</Label>
          <Switch
            checked={settings.game_mode_enabled}
            onCheckedChange={(v) => patch({ game_mode_enabled: v })}
          />
        </div>
        <div className={`rounded p-2 text-sm ${active ? "bg-orange-100 dark:bg-orange-950" : "bg-muted"}`}>
          Status: {active ? "🎮 Active — smooth scrolling paused" : "Inactive"}
        </div>
        <div className="space-y-2">
          <Label>Known games</Label>
          <div className="flex flex-wrap gap-1">
            {settings.game_mode_known_apps.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                {g}
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await tauri.removeKnownGame(g);
                    patch({ game_mode_known_apps: settings.game_mode_known_apps.filter((x) => x !== g) });
                  }}
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="game.exe" value={newGame} onChange={(e) => setNewGame(e.target.value)} />
            <Button
              onClick={async () => {
                if (!newGame.trim()) return;
                await tauri.addKnownGame(newGame);
                patch({ game_mode_known_apps: [...settings.game_mode_known_apps, newGame.trim()] });
                setNewGame("");
              }}
            >Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
