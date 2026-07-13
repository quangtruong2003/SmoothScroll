import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Check, Ban, Globe } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  processName: string;
  selectedProfileId?: string;
  onClose: () => void;
  /** Bounding rect of the tray panel, used for portal positioning. */
  panelRect: DOMRect;
  /** Bounding rect of the pill row, used to align the flyout top. */
  pillRect: DOMRect;
}

export function ProfilePickerPopover({
  processName,
  selectedProfileId,
  onClose,
  panelRect,
  pillRect,
}: Props) {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const ref = useRef<HTMLDivElement | null>(null);

  const profiles = (settings?.profiles ?? [])
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .slice(0, 8);

  const apply = useCallback(async (profileId: string | null) => {
    try {
      if (profileId === null) {
        await invoke("unassign_app_profile", { processName });
      } else {
        await invoke("assign_app_profile", { processName, profileId });
      }
      onClose();
    } catch {
      // keep popover open for retry
    }
  }, [processName, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Flyout: right edge touches panel left edge, top aligns with pill row.
  const gap = 6;
  const flyoutRight = panelRect.left - gap;
  const flyoutTop = pillRect.top;

  return createPortal(
    <div
      ref={ref}
      className="tray-profile-popover"
      role="listbox"
      tabIndex={-1}
      style={{
        right: `${window.innerWidth - flyoutRight}px`,
        top: `${flyoutTop}px`,
        width: `${panelRect.width}px`,
      }}
    >
      <button
        type="button"
        role="option"
        aria-selected={selectedProfileId === undefined}
        className="tray-profile-option"
        onClick={() => apply(null)}
      >
        <Globe className="h-4 w-4" />
        <span>{t("tray.profile_default")}</span>
        {selectedProfileId === undefined && (
          <Check className="ml-auto h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        role="option"
        aria-selected={selectedProfileId === "__disabled__"}
        className="tray-profile-option"
        onClick={() => apply("__disabled__")}
      >
        <Ban className="h-4 w-4" />
        <span>{t("tray.profile_disable")}</span>
        {selectedProfileId === "__disabled__" && (
          <Check className="ml-auto h-4 w-4" />
        )}
      </button>
      <div className="tray-profile-divider" />
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={selectedProfileId === p.id}
          className="tray-profile-option"
          onClick={() => apply(p.id)}
        >
          <span>{p.name}</span>
          {selectedProfileId === p.id && (
            <Check className="ml-auto h-4 w-4" />
          )}
        </button>
      ))}
    </div>,
    document.body,
  );
}
