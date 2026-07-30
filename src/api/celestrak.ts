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
    throw new Error(`CelesTrak request for group "${group}" failed with status ${response.status ?? 'unknown'}`);
  }
  const text = await response.text();
  return parseTleText(text);
}
