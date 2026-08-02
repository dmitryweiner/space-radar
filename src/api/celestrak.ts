import type { TleRecord } from './types';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

export function parseTleText(text: string): TleRecord[] {
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const records: TleRecord[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    records.push({ name: lines[i].trim(), line1: lines[i + 1], line2: lines[i + 2] });
  }
  return records;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  text(): Promise<string>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchTleGroup(group: string, fetchFn: FetchFn = fetch): Promise<TleRecord[]> {
  const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=tle`;
  const response = await fetchFn(url);
  if (!response.ok) {
    // CelesTrak rate-limits by returning 403 with an HTML page (common when
    // requesting several large groups in quick succession).
    if (response.status === 403 || response.status === 429) {
      throw new Error(`CelesTrak is rate-limiting requests (HTTP ${response.status}) — try again in a minute.`);
    }
    throw new Error(`CelesTrak request for group "${group}" failed with status ${response.status ?? 'unknown'}`);
  }
  const text = await response.text();
  return parseTleText(text);
}

// Fetches several groups and merges them, de-duplicating satellites that appear
// in more than one group (e.g. the ISS is in both `stations` and `visual`) by
// their NORAD id (the 5-digit field at the start of TLE line 1). If at least
// one group resolves, partial failures are tolerated so a single bad group
// doesn't blank the card; only an all-groups failure rethrows.
export async function fetchTleGroups(groups: string[], fetchFn: FetchFn = fetch): Promise<TleRecord[]> {
  const results = await Promise.allSettled(groups.map((group) => fetchTleGroup(group, fetchFn)));
  const merged: TleRecord[] = [];
  const seen = new Set<string>();
  let firstError: unknown = null;
  for (const result of results) {
    if (result.status === 'rejected') {
      firstError = firstError ?? result.reason;
      continue;
    }
    for (const record of result.value) {
      const noradId = record.line1.slice(2, 7).trim() || record.name;
      if (seen.has(noradId)) {
        continue;
      }
      seen.add(noradId);
      merged.push(record);
    }
  }
  if (merged.length === 0 && firstError) {
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }
  return merged;
}
