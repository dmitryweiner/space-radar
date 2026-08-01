import type { SpaceWeatherEvent } from './types';
import { describeHttpError } from './httpError';
import { NASA_API_KEY } from './nasaApiKey';

const API_BASE = 'https://api.nasa.gov/DONKI';
const LOOKBACK_DAYS = 7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
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
  return `startDate=${start}&endDate=${end}&api_key=${NASA_API_KEY}`;
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
    throw new Error(describeHttpError('NASA DONKI', response.status, url));
  }
  return response.json();
}

// Flares now come from the far more reliable SWPC GOES feed (see
// src/api/swpc.ts); DONKI is only queried for CMEs, which SWPC has no
// equivalent JSON product for.
export async function fetchCmeEvents(fetchFn: FetchFn = fetch, now: Date = new Date()): Promise<SpaceWeatherEvent[]> {
  return parseCmes(await fetchJson(`${API_BASE}/CME?${dateRangeParams(now)}`, fetchFn));
}
