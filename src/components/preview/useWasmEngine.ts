import { useEffect, useRef, useState } from "react";
import { createEngine, type WasmEngine } from "@/lib/engine-wasm";
import type { AppSettings } from "@/lib/tauri";

/**
 * Hook that creates and updates a WASM engine instance for live preview.
 * Hot-swaps settings on the same engine when settings change.
 */
export function useWasmEngine(settings: AppSettings | null): WasmEngine | null {
  const [engine, setEngine] = useState<WasmEngine | null>(null);
  const ref = useRef<WasmEngine | null>(null);
  const settingsKey = settings ? JSON.stringify(settings) : null;

  useEffect(() => {
    if (!settings || !settingsKey) return;
    let cancelled = false;
    if (!ref.current) {
      void createEngine(settingsKey).then((e) => {
        if (cancelled) return;
        ref.current = e;
        setEngine(e);
      });
    } else {
      ref.current.update_settings(settingsKey);
    }
    return () => {
      cancelled = true;
    };
  }, [settingsKey, settings]);

  return engine;
}
