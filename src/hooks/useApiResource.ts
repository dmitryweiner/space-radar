import { useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from '../api/cache';

export interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiResourceOptions<T> {
  key: string;
  ttlMs: number;
  pollMs: number;
  fetcher: () => Promise<T>;
  isValue: (value: unknown) => value is T;
}

// Several components can share one resource (a dashboard card and the Scene
// view's status bar both show Kp, launches, …). One in-flight request per key,
// and a poll is skipped when another instance refreshed the cache moments
// ago — so N consumers still cost one request per interval (LL2's 15/hour!).
// An entry is dropped once settled *or* once its last waiter unmounts, so a
// hung request can't block a later mount of the same resource forever.
const inFlight = new Map<string, { promise: Promise<unknown>; waiters: number }>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useApiResource<T>({ key, ttlMs, pollMs, fetcher, isValue }: UseApiResourceOptions<T>): ApiResourceState<T> {
  const [state, setState] = useState<ApiResourceState<T>>(() => {
    const cached = readCache(key, ttlMs, isValue);
    return { data: cached, loading: cached === null, error: null };
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    let waiting: { promise: Promise<unknown>; waiters: number } | null = null;

    async function run() {
      const justRefreshed = readCache(key, pollMs / 2, isValue);
      if (justRefreshed !== null) {
        setState({ data: justRefreshed, loading: false, error: null });
        return;
      }
      try {
        let entry = inFlight.get(key);
        if (!entry) {
          const created = { promise: fetcherRef.current(), waiters: 0 };
          const settled = () => {
            if (inFlight.get(key) === created) {
              inFlight.delete(key);
            }
          };
          created.promise.then(settled, settled);
          inFlight.set(key, created);
          entry = created;
        }
        waiting = entry;
        entry.waiters += 1;
        let fetched: unknown;
        try {
          fetched = await entry.promise;
        } finally {
          entry.waiters -= 1;
          waiting = null;
        }
        if (!isValue(fetched)) {
          throw new Error('Unexpected response.');
        }
        const value = fetched;
        if (cancelled) {
          return;
        }
        writeCache(key, value);
        setState({ data: value, loading: false, error: null });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState((prev) => ({ data: prev.data, loading: false, error: errorMessage(error) }));
      }
    }

    if (readCache(key, ttlMs, isValue) === null) {
      run();
    }
    const interval = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (waiting && waiting.waiters <= 1 && inFlight.get(key) === waiting) {
        inFlight.delete(key);
      }
    };
  }, [key, ttlMs, pollMs, isValue]);

  return state;
}
