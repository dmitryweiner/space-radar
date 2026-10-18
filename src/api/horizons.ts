import { fetchViaProxy } from './proxy';
import { describeHttpError } from './httpError';
import type { SpacecraftTrack, TrackSample } from './types';

// JPL Horizons: heliocentric state vectors for spacecraft. ssd.jpl.nasa.gov
// sends no CORS headers, so this only works through the caching proxy (the
// direct fallback in fetchViaProxy fails in a browser by design).
const API_BASE = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const JD_UNIX_EPOCH = 2440587.5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Horizons URL: Sun-centred ecliptic J2000 positions in AU, one CSV row per step. */
export function horizonsUrl(id: string, startMs: number, stopMs: number, stepDays: number): string {
  const params = [
    'format=json',
    `COMMAND='${id}'`,
    'EPHEM_TYPE=VECTORS',
    "CENTER='500@10'",
    `START_TIME='${formatDate(startMs)}'`,
    `STOP_TIME='${formatDate(stopMs)}'`,
    `STEP_SIZE='${stepDays}d'`,
    "OUT_UNITS='AU-D'",
    "REF_PLANE='ECLIPTIC'",
    'VEC_TABLE=1',
    'OBJ_DATA=NO',
    'CSV_FORMAT=YES',
  ];
  return `${API_BASE}?${params.join('&')}`;
}

// Six decimals of an AU is ~150 km — far below a pixel here, and keeps the
// localStorage copy of a year of samples per craft small.
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Rows between $$SOE/$$EOE: "JD, A.D. date, X, Y, Z,". */
export function parseHorizonsVectors(result: string): TrackSample[] {
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start === -1 || end === -1) {
    return [];
  }
  const samples: TrackSample[] = [];
  for (const line of result.slice(start + 5, end).split('\n')) {
    const cells = line.split(',').map((cell) => cell.trim());
    if (cells.length < 5) {
      continue;
    }
    const [jd, , x, y, z] = cells.map(Number);
    if ([jd, x, y, z].every(Number.isFinite)) {
      samples.push({ ms: Math.round((jd - JD_UNIX_EPOCH) * DAY_MS), xAu: round(x), yAu: round(y), zAu: round(z) });
    }
  }
  return samples;
}

/**
 * "No ephemeris for target … after A.D. 2026-NOV-04 01:01:09 TDB" (or "prior
 * to") → the edge of the craft's coverage, so the request can be retried
 * inside it. null if the message isn't a coverage error.
 */
export function coverageLimit(result: string): { side: 'after' | 'prior'; ms: number } | null {
  const match = /No ephemeris for target[^\n]*?(after|prior to) A\.D\. (\d{4})-([A-Z]{3})-(\d{2})/i.exec(result);
  if (!match) {
    return null;
  }
  const month = MONTHS[match[3].toUpperCase()];
  if (month === undefined) {
    return null;
  }
  return {
    side: match[1].toLowerCase() === 'after' ? 'after' : 'prior',
    ms: Date.UTC(Number(match[2]), month, Number(match[4])),
  };
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

// Horizons answers 503 when busy (several requests at once is enough), and
// with no CORS headers the direct fallback can't help — so back off and retry.
const RETRY_DELAYS_MS = [1500, 4000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchResult(fetchFn: FetchFn, url: string, wait: (ms: number) => Promise<void>): Promise<string> {
  let response: FetchResponse | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      await wait(RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      response = await fetchViaProxy(fetchFn, url);
      if (response.ok || (response.status !== undefined && response.status < 500 && response.status !== 429)) {
        break;
      }
    } catch (error) {
      lastError = error;
      response = null;
    }
  }
  if (!response) {
    // The direct fallback can only fail (no CORS upstream), so a throw here
    // means the proxy didn't answer either.
    throw new Error(`JPL Horizons unreachable — it only works through the caching proxy (${String(lastError)})`);
  }
  if (!response.ok) {
    throw new Error(describeHttpError('JPL Horizons', response.status, url));
  }
  const body = await response.json();
  if (isRecord(body) && typeof body.result === 'string') {
    return body.result;
  }
  if (isRecord(body) && typeof body.error === 'string') {
    return body.error;
  }
  throw new Error('JPL Horizons: unexpected response');
}

/**
 * One spacecraft's positions from `startMs` to `stopMs`. A craft whose
 * ephemeris starts later / ends earlier (e.g. a mission's planned end) is
 * retried once inside its coverage instead of failing.
 */
export async function fetchSpacecraftTrack(
  craft: { id: string; name: string; stepDays: number },
  startMs: number,
  stopMs: number,
  fetchFn: FetchFn = fetch,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<SpacecraftTrack> {
  let start = startMs;
  let stop = stopMs;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await fetchResult(fetchFn, horizonsUrl(craft.id, start, stop, craft.stepDays), wait);
    const samples = parseHorizonsVectors(result);
    if (samples.length > 0) {
      return { id: craft.id, samples };
    }
    const limit = coverageLimit(result);
    if (!limit) {
      break;
    }
    // Step a day inside the edge; the date is truncated, the edge is not.
    if (limit.side === 'after') {
      stop = limit.ms - DAY_MS;
    } else {
      start = limit.ms + DAY_MS;
    }
    if (stop <= start) {
      break;
    }
  }
  throw new Error(`JPL Horizons: no positions for ${craft.name}`);
}
