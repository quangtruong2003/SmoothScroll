import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Activity, MousePointer2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tauri, type DailyStats } from "@/lib/tauri";

function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h ${mins % 60}m`;
}

export function StatsTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DailyStats | null>(null);

  useEffect(() => {
    tauri.getDailyStats().then(setStats).catch(() => setStats(null));
    const interval = setInterval(() => {
      tauri.getDailyStats().then(setStats).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <p className="text-sm text-muted-foreground">{t("common.loading_settings")}</p>;
  }

  const distanceCm = stats.total_scroll_distance_px * 0.0265;
  const distanceLabel = distanceCm >= 100
    ? `${(distanceCm / 100).toFixed(1)}m`
    : `${distanceCm.toFixed(0)}cm`;

  const topApps = Object.entries(stats.app_distances)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const total = topApps.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("stats.today", "Today's Scroll Stats")}</h2>
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <MousePointer2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{distanceLabel}</p>
            <p className="text-xs text-muted-foreground">{t("stats.distance", "Distance")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{formatTime(stats.active_time_ms)}</p>
            <p className="text-xs text-muted-foreground">{t("stats.active_time", "Active")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{stats.total_notches.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t("stats.notches", "Notches")}</p>
          </CardContent>
        </Card>
      </div>
      {topApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stats.top_apps", "Top Apps")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topApps.map(([name, px], i) => {
              const pct = total > 0 ? (px / total) * 100 : 0;
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-sm font-medium truncate flex-1">{name}</span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("stats.peak_velocity", "Peak velocity")}</span>
            <span className="font-medium tabular-nums">{stats.peak_velocity.toFixed(1)} {t("stats.notches_sec", "notches/sec")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("stats.profile_switches", "Profile switches")}</span>
            <span className="font-medium tabular-nums">{stats.profile_switches}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
