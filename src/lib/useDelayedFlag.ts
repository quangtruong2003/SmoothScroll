import { useEffect, useState } from "react";

/**
 * Returns true after `delayMs` has elapsed since the hook mounted.
 * Useful to avoid flashing transient loading UI for fast operations.
 */
export function useDelayedFlag(delayMs: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return flag;
}
