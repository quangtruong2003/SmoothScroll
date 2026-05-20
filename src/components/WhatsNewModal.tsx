import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";

const STORAGE_KEY = "ss.whatsnew.lastSeenVersion";

interface ChangelogEntry {
  version: string;
  highlightKeys: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    highlightKeys: [
      "whatsnew.highlights.0_2_0.onboarding",
      "whatsnew.highlights.0_2_0.permission",
      "whatsnew.highlights.0_2_0.feel_hints",
      "whatsnew.highlights.0_2_0.cheatsheet",
      "whatsnew.highlights.0_2_0.backup",
    ],
  },
];

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await tauri.appVersion().catch(() => null);
      if (!v || cancelled) return;
      setVersion(v);
      const last = localStorage.getItem(STORAGE_KEY);
      if (last == null || compareVersions(v, last) > 0) {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (version) localStorage.setItem(STORAGE_KEY, version);
    setOpen(false);
  };

  if (!open || !version) return null;

  // Find the most relevant entry — best-effort match on major.minor.
  const entry =
    CHANGELOG.find((e) => version.startsWith(e.version)) ?? CHANGELOG[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-background/80 backdrop-blur"
    >
      <div className="w-[520px] max-w-[92vw] rounded-xl border border-border bg-background p-6 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="whatsnew-title" className="text-base font-semibold">
                {t("whatsnew.title", "What's new")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("whatsnew.version_label", { version })}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("whatsnew.dismiss")}
            onClick={dismiss}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("whatsnew.tagline")}
        </p>
        <ul className="mb-5 space-y-2">
          {entry.highlightKeys.map((key) => (
            <li
              key={key}
              className="flex gap-2 text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={dismiss}>
            {t("whatsnew.dismiss")}
          </Button>
        </div>
      </div>
    </div>
  );
}
