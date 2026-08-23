import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauri, type ForegroundAppContext } from '@/lib/tauri';

const POLL_INTERVAL_MS = 2000;

export function useForegroundApp(): {
  ctx: ForegroundAppContext | null;
  loaded: boolean;
  refresh: () => Promise<void>;
} {
  const [ctx, setCtx] = useState<ForegroundAppContext | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await tauri.getForegroundAppContext();
      setCtx(next);
    } catch {
      setCtx(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unlisten = listen('settings-changed', () => void refresh());
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => {
      void unlisten.then((u) => u()).catch(() => {});
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { ctx, loaded, refresh };
}
