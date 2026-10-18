import { fetchViaProxy } from './proxy';
import { describeHttpError } from './httpError';
import type { Comet } from './types';

// JPL Small-Body Database Query API. ssd-api.jpl.nasa.gov sends no CORS
// headers, so this only works through the caching proxy.
const API_BASE = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const FIELDS = 'full_name,pdes,q,e,i,om,w,tp,M1';
const DAY_MS = 24 * 60 * 60 * 1000;
const JD_UNIX_EPOCH = 2440587.5;

/** Well-known periodic comets (incl. spacecraft targets and shower parents). */
export const FAMOUS_COMETS = ['1P', '2P', '9P', '12P', '19P', '21P', '46P', '55P', '67P', '81P', '103P', '109P'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const parsed = Number(value);
  return value === '' || !Number.isFinite(parsed) ? null : parsed;
}

/** `{ fields, data: [[cells…]] }` → comets; rows missing an element are skipped. */
export function parseComets(raw: unknown): Comet[] {
  if (!isRecord(raw) || !Array.isArray(raw.fields) || !Array.isArray(raw.data)) {
    return [];
  }
  const fields = raw.fields;
  const col = (name: string) => fields.indexOf(name);
  const index = { name: col('full_name'), id: col('pdes'), q: col('q'), e: col('e'), i: col('i'), node: col('om'), peri: col('w'), tp: col('tp'), mag: col('M1') };
  const comets: Comet[] = [];
  for (const row of raw.data) {
    if (!Array.isArray(row)) {
      continue;
    }
    const q = toNumber(row[index.q]);
    const e = toNumber(row[index.e]);
    const i = toNumber(row[index.i]);
    const node = toNumber(row[index.node]);
    const peri = toNumber(row[index.peri]);
    const tpJd = toNumber(row[index.tp]);
    const id = row[index.id];
    const name = row[index.name];
    if (q === null || e === null || i === null || node === null || peri === null || tpJd === null || typeof id !== 'string') {
      continue;
    }
    comets.push({
      id,
      name: typeof name === 'string' ? name.trim() : id,
      q,
      e,
      i,
      node,
      peri,
      tpJd,
      magnitude: toNumber(row[index.mag]),
    });
  }
  return comets;
}

/**
 * Comets around perihelion now: perihelion within ±`windowDays` of `now`
 * (rounded to the day, so the proxy caches one copy per day) inside
 * `maxQ` AU, brightest (lowest M1) first.
 */
export function activeCometsUrl(now: Date, windowDays: number, maxQ: number, limit: number): string {
  const todayJd = Math.floor(now.getTime() / DAY_MS) + JD_UNIX_EPOCH;
  const cdata = JSON.stringify({ AND: [`tp|RG|${todayJd - windowDays}|${todayJd + windowDays}`, `q|LT|${maxQ}`] });
  return `${API_BASE}?fields=${FIELDS}&sb-kind=c&sort=M1&limit=${limit}&sb-cdata=${encodeURIComponent(cdata)}`;
}

export function famousCometsUrl(): string {
  const cdata = JSON.stringify({ OR: FAMOUS_COMETS.map((id) => `pdes|EQ|${id}`) });
  return `${API_BASE}?fields=${FIELDS}&sb-kind=c&sb-cdata=${encodeURIComponent(cdata)}`;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchComets(url: string, fetchFn: FetchFn = fetch): Promise<Comet[]> {
  let response: FetchResponse;
  try {
    response = await fetchViaProxy(fetchFn, url);
  } catch {
    // The direct fallback can only fail here (no CORS upstream).
    throw new Error('JPL SBDB unreachable — it only works through the caching proxy');
  }
  if (!response.ok) {
    throw new Error(describeHttpError('JPL SBDB', response.status, url));
  }
  return parseComets(await response.json());
}
