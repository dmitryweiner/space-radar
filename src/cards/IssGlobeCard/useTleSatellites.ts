import { useEffect, useState } from 'react';
import { fetchTleGroup } from '../../api/celestrak';
import { readCache, writeCache } from '../../api/cache';
import type { TleRecord } from '../../api/types';

const GROUP_TTL_MS = 6 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTleRecords(value: unknown): value is TleRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        typeof item.line1 === 'string' &&
        typeof item.line2 === 'string',
    )
  );
}

// Each CelesTrak group is cached under its OWN key, so toggling groups on/off
// reuses already-fetched ones instead of re-requesting a whole new combination
// each time. That both avoids CelesTrak's 403 rate-limiting and keeps
// localStorage bounded to at most one entry per group (not per combination).
async function loadGroup(group: string): Promise<TleRecord[]> {
  const key = `space-radar:tle-group:${group}`;
  const cached = readCache(key, GROUP_TTL_MS, isTleRecords);
  if (cached) {
    return cached;
  }
  const records = await fetchTleGroup(group);
  writeCache(key, records);
  return records;
}

function mergeDedup(groups: TleRecord[][]): TleRecord[] {
  const merged: TleRecord[] = [];
  const seen = new Set<string>();
  for (const records of groups) {
    for (const record of records) {
      // NORAD id = the 5-digit field at the start of TLE line 1.
      const noradId = record.line1.slice(2, 7).trim() || record.name;
      if (!seen.has(noradId)) {
        seen.add(noradId);
        merged.push(record);
      }
    }
  }
  return merged;
}

export interface TleState {
  data: TleRecord[] | null;
  loading: boolean;
  error: string | null;
}

interface InternalState {
  data: TleRecord[] | null;
  error: string | null;
  /** The selection key these results belong to; loading = it lags behind. */
  loadedKey: string | null;
}

export function useTleSatellites(categories: string[]): TleState {
  const key = [...categories].sort().join(',');
  const [state, setState] = useState<InternalState>({ data: null, error: null, loadedKey: null });

  useEffect(() => {
    let cancelled = false;
    const groups = key.split(',').filter((group) => group.length > 0);

    (async () => {
      const results = await Promise.allSettled(groups.map(loadGroup));
      if (cancelled) {
        return;
      }
      const succeeded: TleRecord[][] = [];
      let firstError: unknown = null;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          succeeded.push(result.value);
        } else {
          firstError = firstError ?? result.reason;
        }
      }
      const merged = mergeDedup(succeeded);
      if (merged.length === 0 && firstError) {
        setState({ data: null, error: firstError instanceof Error ? firstError.message : String(firstError), loadedKey: key });
      } else {
        setState({ data: merged, error: null, loadedKey: key });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Loading whenever the results on hand predate the current selection. Keep the
  // previous data visible during a reload, and suppress a stale error.
  const loading = state.loadedKey !== key;
  return { data: state.data, loading, error: loading ? null : state.error };
}
