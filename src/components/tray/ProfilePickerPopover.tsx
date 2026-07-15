import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Check, Ban, Globe } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  processName: string;
  selectedProfileId?: string;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function ProfilePickerPopover({
  processName,
  selectedProfileId,
  triggerRef,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const profiles = (settings?.profiles ?? [])
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .slice(0, 8);

  // Position popover relative to trigger
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [triggerRef]);

  const apply = useCallback(
    async (profileId: string | null) => {
      // Normalize sentinel "__disabled__" for idempotency check; null = "Default (global)".
      const currentId = selectedProfileId ?? null;
      const nextId = profileId ?? null;
      const isSame = currentId === nextId;

      try {
        if (isSame) {
          // Re-selecting the current entry just closes the popover.
          onClose();
          return;
        }
        if (profileId === null) {
          await invoke("unassign_app_profile", { processName });
        } else {
          await invoke("assign_app_profile", { processName, profileId });
        }
        onClose();
      } catch {
        // keep popover open for retry
      }
    },
    [processName, selectedProfileId, onClose],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const popover = (
    <div
      ref={ref}
      className="tray-profile-popover"
      role="listbox"
      tabIndex={-1}
      style={pos ? { position: "fixed", top: pos.top, right: pos.right } : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
    </div>
  );

  return createPortal(popover, document.body);
}
