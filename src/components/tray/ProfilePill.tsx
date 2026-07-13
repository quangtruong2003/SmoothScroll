import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { ProfilePickerPopover } from "./ProfilePickerPopover";
import type { ForegroundAppContext } from "@/lib/tauri";

interface ProfilePillProps {
  ctx: ForegroundAppContext | null;
}

export function ProfilePill({ ctx }: ProfilePillProps): React.ReactNode | null {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const [rects, setRects] = useState<{
    panel: DOMRect;
    pill: DOMRect;
  } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const profiles = settings?.profiles ?? [];
  const processName = ctx?.process_name ?? "";
  const profileId = processName
    ? settings?.app_profiles[processName]
    : undefined;

  const updateRects = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const panelRoot = row.closest(".tray-panel-root");
    if (!panelRoot) return;
    setRects({
      panel: panelRoot.getBoundingClientRect(),
      pill: row.getBoundingClientRect(),
    });
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) updateRects();
      return !prev;
    });
  }, [updateRects]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close if click is outside the pill row AND outside the portal flyout.
      const flyout = document.querySelector(".tray-profile-popover");
      if (
        rowRef.current &&
        !rowRef.current.contains(target) &&
        (!flyout || !flyout.contains(target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!processName || profiles.length === 0) return null;

  const selectedLabel = ctx?.is_excluded
    ? t("tray.profile_disabled")
    : profiles.find((p) => p.id === profileId)?.name ??
      t("tray.profile_default");

  return (
    <div ref={rowRef} className="tray-row">
      <span className="tray-row-label tray-profile-pill-label">
        {t("tray.profile_label")}: {selectedLabel}
      </span>
      <button
        type="button"
        className="tray-row-icon"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("tray.profile_label")}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && rects && (
        <ProfilePickerPopover
          processName={processName}
          selectedProfileId={profileId}
          onClose={() => setOpen(false)}
          panelRect={rects.panel}
          pillRect={rects.pill}
        />
      )}
    </div>
  );
}
