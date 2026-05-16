import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface HotkeyRecorderInputProps {
  value: string;
  onCommit: (accel: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

const MOD_ORDER = ["Ctrl", "Alt", "Shift", "Win"] as const;

function normalize(parts: { mods: Set<string>; key: string }): string {
  const mods = MOD_ORDER.filter((m) => parts.mods.has(m));
  return [...mods, parts.key].join("+");
}

function isPlainKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return null;
}

export function HotkeyRecorderInput({
  value,
  onCommit,
  disabled,
  className,
}: HotkeyRecorderInputProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!recording) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();

    const mods = new Set<string>();
    let lastKey = "";

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      if (e.ctrlKey) mods.add("Ctrl");
      if (e.altKey) mods.add("Alt");
      if (e.shiftKey) mods.add("Shift");
      if (e.metaKey) mods.add("Win");
      const plain = isPlainKey(e.code);
      if (plain) lastKey = plain;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return;
      const plain = isPlainKey(e.code);
      if (!plain) return;
      if (mods.size === 0) return;
      const accel = normalize({ mods, key: lastKey || plain });
      setRecording(false);
      void onCommit(accel);
    };

    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
    };
  }, [recording, onCommit]);

  return (
    <div
      ref={inputRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={t("settings.hotkey_accelerator.aria")}
      onClick={() => !disabled && setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setRecording(true);
        }
      }}
      className={cn(
        "inline-flex h-9 min-w-[10rem] items-center justify-center rounded-md border bg-background px-3 text-sm font-mono",
        "outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring",
        recording && "ring-2 ring-primary border-primary",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {recording
        ? t("settings.hotkey_accelerator.press")
        : value || t("settings.hotkey_accelerator.empty")}
    </div>
  );
}
