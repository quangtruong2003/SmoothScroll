import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tauri } from "@/lib/tauri";
import { parseChangelog, type ChangelogEntry } from "@/lib/changelogParser";
import rawChangelog from "@/lib/CHANGELOG.md?raw";

const STORAGE_KEY = "ss.whatsnew.lastSeenVersion";
const RELEASES_URL_BASE = "https://github.com/quangtruong2003/SmoothScroll/releases/tag/";

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualTrigger, setManualTrigger] = useState(false);

  // Listen for manual trigger from AboutSection
  useEffect(() => {
    const handler = () => setManualTrigger(true);
    window.addEventListener("whatsnew:open", handler);
    return () => window.removeEventListener("whatsnew:open", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await tauri.appVersion().catch(() => null);
      if (!v || cancelled) return;
      setVersion(v);
      const last = localStorage.getItem(STORAGE_KEY);
      const isNewVersion = last == null || compareVersions(v, last) > 0;
      if (isNewVersion || manualTrigger) {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manualTrigger]);

  const dismiss = () => {
    if (version && !manualTrigger) {
      try {
        localStorage.setItem(STORAGE_KEY, version);
      } catch {
        // localStorage disabled — silent fail
      }
    }
    setManualTrigger(false);
    setOpen(false);
  };

  if (!open || !version) return null;

  let entry: ChangelogEntry | null = null;
  try {
    entry = parseChangelog(rawChangelog, version);
  } catch (e) {
    console.warn("[WhatsNew] failed to parse CHANGELOG.md:", e);
    return null;
  }

  if (!entry) return null;

  const totalItems = entry.sections.reduce((sum, s) => sum + s.items.length, 0);

  const onViewFullChangelog = () => {
    const tagVersion = version.split(/[-+]/)[0];
    void openUrl(`${RELEASES_URL_BASE}v${tagVersion}`).catch((e: unknown) => {
      console.warn("[WhatsNew] failed to open changelog URL:", e);
    });
  };

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
        <p className="mb-4 text-sm text-muted-foreground">
          {t("whatsnew.tagline")}
        </p>

        {totalItems === 0 ? (
          <p className="mb-5 text-sm text-muted-foreground">
            {t("whatsnew.minor_fixes_only")}
          </p>
        ) : (
          <div className="mb-5 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {entry.sections.map((section) => (
              <section key={section.kind}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`whatsnew.section_${section.kind.toLowerCase()}`)}
                </h3>
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onViewFullChangelog}
            className="text-sm text-primary hover:underline"
          >
            {t("whatsnew.view_changelog")} →
          </button>
          <Button onClick={dismiss}>{t("whatsnew.dismiss")}</Button>
        </div>
      </div>
    </div>
  );
}

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