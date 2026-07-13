import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useForegroundApp } from "@/hooks/useForegroundApp";
import { useSettingsStore } from "@/stores/settingsStore";
import { ProfilePickerPopover } from "./ProfilePickerPopover";

export function ProfilePill(): React.ReactNode | null {
  const { t } = useTranslation();
  const { ctx } = useForegroundApp();
  const settings = useSettingsStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const profiles = settings?.profiles ?? [];
  const processName = ctx?.process_name ?? "";
  const profileId = processName
    ? settings?.app_profiles[processName]
    : undefined;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!processName || profiles.length === 0) return null;

  const selectedLabel = ctx?.is_excluded
    ? t("tray.current_app.disabled")
    : profiles.find((p) => p.id === profileId)?.name ??
      t("tray.current_app.default");

  return (
    <div ref={rootRef} className="tray-row">
      <span className="tray-row-label tray-profile-pill-label">
        {t("tray.current_app.profile")}: {selectedLabel}
      </span>
      <button
        type="button"
        className="tray-row-icon"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("tray.current_app.profile")}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <ProfilePickerPopover
          processName={processName}
          selectedProfileId={profileId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
