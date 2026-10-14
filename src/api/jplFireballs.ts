import type { Fireball } from './types';
import { fetchViaProxy } from './proxy';
import { describeHttpError } from './httpError';

// JPL's fireball (bolide) database. ssd-api.jpl.nasa.gov sends no CORS
// headers, so this only works through the caching proxy — the direct
// fallback in fetchViaProxy fails in a browser by design.
const API_BASE = 'https://ssd-api.jpl.nasa.gov/fireball.api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// `{ fields: [...names], data: [[...string cells]] }`; lat/lon are unsigned
// magnitudes with separate N/S, E/W direction columns.
export function parseFireballs(raw: unknown): Fireball[] {
  if (!isRecord(raw) || !Array.isArray(raw.fields) || !Array.isArray(raw.data)) {
    return [];
  }
  const fields = raw.fields;
  const col = (name: string) => fields.indexOf(name);
  const [iDate, iEnergy, iLat, iLatDir, iLon, iLonDir, iAlt, iVel] = [
    col('date'),
    col('impact-e'),
    col('lat'),
    col('lat-dir'),
    col('lon'),
    col('lon-dir'),
    col('alt'),
    col('vel'),
  ];
  if (iDate === -1 || iLat === -1 || iLon === -1) {
    return [];
  }
  const fireballs: Fireball[] = [];
  for (const row of raw.data) {
    if (!Array.isArray(row)) {
      continue;
    }
    const date = row[iDate];
    const lat = toNumber(row[iLat]);
    const lon = toNumber(row[iLon]);
    if (typeof date !== 'string' || lat === null || lon === null) {
      continue;
    }
    fireballs.push({
      date,
      latitude: row[iLatDir] === 'S' ? -lat : lat,
      longitude: row[iLonDir] === 'W' ? -lon : lon,
      impactEnergyKt: (iEnergy !== -1 ? toNumber(row[iEnergy]) : null) ?? 0,
      altitudeKm: iAlt !== -1 ? toNumber(row[iAlt]) : null,
      velocityKmS: iVel !== -1 ? toNumber(row[iVel]) : null,
    });
  }
  return fireballs;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

/** Located fireballs since `since` (YYYY-MM-DD). */
export async function fetchFireballs(since: string, fetchFn: FetchFn = fetch): Promise<Fireball[]> {
  const url = `${API_BASE}?date-min=${since}&req-loc=true`;
  let response: FetchResponse;
  try {
    response = await fetchViaProxy(fetchFn, url);
  } catch {
    throw new Error('JPL fireball data is only reachable through the Space Radar proxy, which is unavailable right now.');
  }
  if (!response.ok) {
    throw new Error(describeHttpError('JPL fireballs', response.status, url));
  }
  return parseFireballs(await response.json());
}
