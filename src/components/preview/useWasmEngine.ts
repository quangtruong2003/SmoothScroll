import { useEffect, useRef, useState } from "react";
import { createEngine, type WasmEngine } from "@/lib/engineWasm";
import type { AppSettings } from "@/lib/tauri";

/**
 * Hook that creates and updates a WASM engine instance for live preview.
 * Hot-swaps settings on the same engine when settings change. Frees the
 * Rust-side engine on unmount — wasm-bindgen objects do not free themselves,
 * so leaking one per wizard run grows memory for the whole session.
 */
export function useWasmEngine(settings: AppSettings | null): WasmEngine | null {
  const [engine, setEngine] = useState<WasmEngine | null>(null);
  const ref = useRef<WasmEngine | null>(null);
  const settingsKey = settings ? JSON.stringify(settings) : null;

  useEffect(() => {
    if (!settings || !settingsKey) return;
    let cancelled = false;
    if (!ref.current) {
      void createEngine(settingsKey)
        .then((e: WasmEngine) => {
          if (cancelled) {
            e.free();
            return;
          }
          ref.current = e;
          setEngine(e);
        })
        .catch((e: unknown) => {
          console.error("wasm engine init failed", e);
        });
    } else {
      ref.current.update_settings(settingsKey);
    }
    return () => {
      cancelled = true;
    };
  }, [settingsKey, settings]);

  // Free the engine exactly once on unmount.
  useEffect(() => {
    return () => {
      ref.current?.free();
      ref.current = null;
    };
  }, []);

  return engine;
}
