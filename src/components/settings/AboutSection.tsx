import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";

export function AboutSection() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    tauri.appVersion().then(setVersion);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("section.about")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.version")}</span>
          <span className="font-medium tabular-nums">{version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("about.homepage")}</span>
          <a
            href={t("about.homepage_url")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            github.com/…
          </a>
        </div>
        <Button variant="outline" size="sm" onClick={() => tauri.openLogDir()}>
          {t("about.open_logs")}
        </Button>
      </CardContent>
    </Card>
  );
}
