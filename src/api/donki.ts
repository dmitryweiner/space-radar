import type { SpaceWeatherEvent } from './types';

const API_BASE = 'https://api.nasa.gov/DONKI';
const API_KEY = 'DEMO_KEY';
const LOOKBACK_DAYS = 7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseFlares(raw: unknown): SpaceWeatherEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const events: SpaceWeatherEvent[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const id = item.flrID;
    const time = item.beginTime;
    if (typeof id !== 'string' || typeof time !== 'string') {
      continue;
    }
    events.push({
      kind: 'flare',
      id,
      time,
      classType: toNullableString(item.classType),
      sourceLocation: toNullableString(item.sourceLocation),
    });
  }
  return events;
}

export function parseCmes(raw: unknown): SpaceWeatherEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const events: SpaceWeatherEvent[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const id = item.activityID;
    const time = item.startTime;
    if (typeof id !== 'string' || typeof time !== 'string') {
      continue;
    }
    events.push({
      kind: 'cme',
      id,
      time,
      classType: null,
      sourceLocation: toNullableString(item.sourceLocation),
    });
  }
  return events;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRangeParams(now: Date): string {
  const end = formatDate(now);
  const start = formatDate(new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  return `startDate=${start}&endDate=${end}&api_key=${API_KEY}`;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

async function fetchJson(url: string, fetchFn: FetchFn): Promise<unknown> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`NASA DONKI request failed with status ${response.status ?? 'unknown'}: ${url}`);
  }
  return response.json();
}

function byTimeDescending(a: SpaceWeatherEvent, b: SpaceWeatherEvent): number {
  if (a.time < b.time) {
    return 1;
  }
  if (a.time > b.time) {
    return -1;
  }
  return 0;
}

export async function fetchSpaceWeatherEvents(
  fetchFn: FetchFn = fetch,
  now: Date = new Date(),
): Promise<SpaceWeatherEvent[]> {
  const params = dateRangeParams(now);
  const [flrRaw, cmeRaw] = await Promise.all([
    fetchJson(`${API_BASE}/FLR?${params}`, fetchFn),
    fetchJson(`${API_BASE}/CME?${params}`, fetchFn),
  ]);
  return [...parseFlares(flrRaw), ...parseCmes(cmeRaw)].sort(byTimeDescending);
}
