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

    async function run() {
      try {
        const value = await fetcherRef.current();
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
    };
  }, [key, ttlMs, pollMs, isValue]);

  return state;
}
