import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, X } from "lucide-react";

/**
 * Keyboard cheat sheet — toggled by `?` (or Cmd/Ctrl+/). Lists global
 * hotkeys and useful tips so users discover features without hunting.
 */
export function CheatSheetOverlay() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input/textarea.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true;

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (isTyping) return;
      if (e.key === "?" || (e.key === "/" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";

  const rows: { keys: string[]; label: string }[] = [
    { keys: ["?"], label: t("cheatsheet.toggle", "Show / hide this sheet") },
    { keys: [`${mod}`, "/"], label: t("cheatsheet.toggle_alt", "Same — alternative") },
    { keys: ["Ctrl", "Alt", "S"], label: t("cheatsheet.toggle_smoothing", "Toggle smooth scrolling on/off (rebindable)") },
    { keys: ["Esc"], label: t("cheatsheet.close", "Close dialogs / this sheet") },
    { keys: ["Tab"], label: t("cheatsheet.tab", "Move focus between controls") },
    { keys: ["Space"], label: t("cheatsheet.space_slider", "Toggle slider value (when focused)") },
    { keys: ["←", "→"], label: t("cheatsheet.arrows", "Adjust slider step-by-step") },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] max-w-[90vw] rounded-xl border border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h2 id="cheatsheet-title" className="text-sm font-semibold">
              {t("cheatsheet.title", "Keyboard shortcuts")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("cheatsheet.close", "Close")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <ul className="space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {row.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[0.77rem] font-mono uppercase tracking-wide"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <footer className="mt-4 text-center text-[0.77rem] text-muted-foreground">
          {t("cheatsheet.hint", "Press ? anywhere to open this sheet")}
        </footer>
      </div>
    </div>
  );
}
