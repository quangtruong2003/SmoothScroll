import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * In-app scrollable area so users can feel current scroll settings without
 * leaving the Settings window. Hook intercepts wheel events globally, so
 * scrolling inside the box exercises the real engine.
 */
export function TestSandboxSection() {
  const { t } = useTranslation();
  const items = useMemo(
    () => Array.from({ length: 100 }, (_, i) => i + 1),
    [],
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>{t("section.test_scroll")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("test_scroll.description")}
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/20 p-4">
          <ul className="space-y-2 text-sm font-mono">
            {items.map((n) => (
              <li
                key={n}
                className="flex items-center justify-between border-b border-dashed border-border/50 pb-1 last:border-b-0"
              >
                <span className="text-muted-foreground">#{n}</span>
                <span>{t("test_scroll.line", { n })}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
