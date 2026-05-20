import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadStats, resetStats, type LocalStats } from "@/lib/localStats";

function formatDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}

export function StatsSection() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<LocalStats | null>(null);

  useEffect(() => {
    setStats(loadStats());
  }, []);

  if (!stats) return null;

  const since = formatDuration(Date.now() - stats.firstSeenAt);

  const onReset = () => {
    if (
      !window.confirm(
        t(
          "stats.confirm_reset",
          "This will clear all locally-stored statistics. Continue?",
        ),
      )
    )
      return;
    resetStats();
    setStats(loadStats());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t("stats.title", "Your stats (local only)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {t(
            "stats.description",
            "These numbers stay on your device. Nothing is uploaded.",
          )}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-muted/20 p-3 text-xs">
          <dt className="text-muted-foreground">
            {t("stats.sessions", "Sessions")}
          </dt>
          <dd className="text-right font-medium tabular-nums">
            {stats.sessionCount}
          </dd>
          <dt className="text-muted-foreground">
            {t("stats.using_for", "Using for")}
          </dt>
          <dd className="text-right font-medium tabular-nums">{since}</dd>
        </dl>
        <Button variant="outline" size="sm" onClick={onReset}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {t("stats.reset", "Reset stats")}
        </Button>
      </CardContent>
    </Card>
  );
}
