import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BatteryLow, BatteryFull } from "lucide-react";

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  addEventListener: (
    type: "levelchange" | "chargingchange",
    listener: () => void,
  ) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

const LOW_THRESHOLD = 0.2;

/**
 * Battery awareness banner — shown when a laptop battery drops below 20%
 * and isn't charging. Hint, not enforcement: lets the user know smooth
 * scrolling has slight CPU cost without forcing a behavior change.
 */
export function BatteryHint() {
  const { t } = useTranslation();
  const [low, setLow] = useState(false);
  const [charging, setCharging] = useState(true);

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== "function") return;
    let battery: BatteryManager | null = null;
    let cancelled = false;

    const sync = () => {
      if (!battery || cancelled) return;
      setLow(battery.level <= LOW_THRESHOLD);
      setCharging(battery.charging);
    };

    void nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!low || charging) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      {low ? (
        <BatteryLow className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <BatteryFull className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        {t(
          "battery.low_hint",
          "Battery is low. Smooth scrolling adds a small CPU cost — consider turning it off temporarily.",
        )}
      </span>
    </div>
  );
}
