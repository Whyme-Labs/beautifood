import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Poll a loader while the page is visible. Polling pauses in background tabs
 * and backs off when nothing changes (the loader returns `null` for "no change").
 */
export function usePoll<T>(load: () => Promise<T | null>, opts: { interval?: number; maxInterval?: number; deps?: unknown[]; enabled?: boolean } = {}) {
  const { interval = 2000, maxInterval = 10_000, deps = [], enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  loader.current = load;
  const tick = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => tick.current(), []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let delay = interval;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      clearTimeout(timer);
      try {
        const next = await loader.current();
        if (stopped) return;
        if (next !== null) {
          setData(next);
          delay = interval;
        } else delay = Math.min(maxInterval, Math.round(delay * 1.5));
        setError(null);
      } catch (e) {
        if (!stopped) setError(e as Error);
        delay = Math.min(maxInterval, delay * 2);
      } finally {
        if (!stopped) setLoading(false);
      }
      if (!stopped && interval > 0) timer = setTimeout(() => (document.hidden ? waitVisible() : run()), delay);
    };
    const waitVisible = () => {
      const onVis = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVis);
          run();
        }
      };
      document.addEventListener("visibilitychange", onVis);
    };
    tick.current = run;
    run();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, ...deps]);

  return { data, setData, error, loading, refresh };
}

export function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw));
    } catch {
      /* private mode */
    }
  }, [key]);
  const set = useCallback(
    (nv: T) => {
      setV(nv);
      try {
        localStorage.setItem(key, JSON.stringify(nv));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [v, set];
}

export function useQuery() {
  const [q, setQ] = useState<URLSearchParams>(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  return q;
}
