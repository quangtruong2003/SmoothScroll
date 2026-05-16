import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { tauri } from "@/lib/tauri";
import { Button } from "@/components/ui/button";

export function PermissionGate({ onGranted }: { onGranted: () => void }) {
  const { t } = useTranslation();
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!polling) return;
    const id = window.setInterval(async () => {
      const ok = await tauri.accessibilityStatus();
      if (ok) {
        window.clearInterval(id);
        onGranted();
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [polling, onGranted]);

  const requestPrompt = async () => {
    await tauri.accessibilityRequestPrompt();
    setPolling(true);
  };

  return (
    <div className="container max-w-md py-12 space-y-4">
      <h1 className="text-2xl font-semibold">
        {t("permission.title", "Accessibility access required")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "permission.body",
          "Soft Scroll Next needs Accessibility permission to capture mouse-wheel events and re-emit them with smooth animation. Open System Settings → Privacy & Security → Accessibility and toggle Soft Scroll Next on.",
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={requestPrompt}>
          {t("permission.open", "Request permission")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "permission.polling",
          "I'll detect when you grant it and continue.",
        )}
      </p>
    </div>
  );
}
