import { useEffect, useRef } from "react";
import type { WasmEngine } from "@/lib/engine-wasm";

interface Props {
  engine: WasmEngine | null;
  /** Only the active pane receives wheel events. */
  active: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Single-pane scroll preview driven by the WASM engine. Captures wheel,
 * routes through `engine.on_wheel`, and animates `scrollTop` from
 * `engine.step(dt)` on rAF.
 */
export function ScrollPreviewArea({ engine, active, className, children }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Wheel capture
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !engine) return;
    const onWheel = (e: WheelEvent) => {
      if (!active) return;
      e.preventDefault();
      // Browser deltaY is pixels; engine input is wheel-notch units (WHEEL_DELTA = 120).
      // ~100 px per notch is the standard mapping.
      const wheelDelta = Math.round((-e.deltaY / 100) * 120);
      if (wheelDelta !== 0) engine.on_wheel(wheelDelta, performance.now());
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [engine, active]);

  // RAF loop
  useEffect(() => {
    if (!engine) return;
    const loop = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const out = engine.step(dt);
      if (out[0] !== 0 && containerRef.current) {
        const px = -(out[0] / 120) * 100;
        containerRef.current.scrollTop += px;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto rounded-md border border-border bg-background ${
        active ? "ring-2 ring-primary" : ""
      } ${className ?? ""}`}
      style={{ height: 240, scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  );
}
