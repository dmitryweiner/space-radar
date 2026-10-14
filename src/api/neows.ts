import type { Asteroid } from './types';
import { fetchViaProxy } from './proxy';
import { describeHttpError } from './httpError';
import { NASA_API_KEY } from './nasaApiKey';

const API_BASE = 'https://api.nasa.gov/neo/rest/v1/feed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseAsteroidRecord(item: unknown): Asteroid | null {
  if (!isRecord(item)) {
    return null;
  }
  const { id, name } = item;
  const hazardous = item.is_potentially_hazardous_asteroid;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof hazardous !== 'boolean') {
    return null;
  }

  const estimatedDiameter = item.estimated_diameter;
  if (!isRecord(estimatedDiameter) || !isRecord(estimatedDiameter.kilometers)) {
    return null;
  }
  const diameterMinKm = toNumber(estimatedDiameter.kilometers.estimated_diameter_min);
  const diameterMaxKm = toNumber(estimatedDiameter.kilometers.estimated_diameter_max);
  if (diameterMinKm === null || diameterMaxKm === null) {
    return null;
  }

  const closeApproachData = item.close_approach_data;
  if (!Array.isArray(closeApproachData) || closeApproachData.length === 0) {
    return null;
  }
  const approach = closeApproachData[0];
  if (!isRecord(approach)) {
    return null;
  }
  const closeApproachDate = approach.close_approach_date_full;
  if (typeof closeApproachDate !== 'string') {
    return null;
  }
  if (!isRecord(approach.relative_velocity) || !isRecord(approach.miss_distance)) {
    return null;
  }
  const relativeVelocityKmH = toNumber(approach.relative_velocity.kilometers_per_hour);
  const missDistanceKm = toNumber(approach.miss_distance.kilometers);
  if (relativeVelocityKmH === null || missDistanceKm === null) {
    return null;
  }

  const epoch = toNumber(approach.epoch_date_close_approach);
  const orbital = isRecord(item.orbital_data) ? item.orbital_data : null;
  const orbitClass = orbital && isRecord(orbital.orbit_class) ? orbital.orbit_class.orbit_class_type : null;

  return {
    id,
    name,
    hazardous,
    diameterMinKm,
    diameterMaxKm,
    closeApproachDate,
    missDistanceKm,
    relativeVelocityKmH,
    jplUrl: typeof item.nasa_jpl_url === 'string' ? item.nasa_jpl_url : null,
    ...(epoch !== null ? { closeApproachMs: epoch } : {}),
    ...(orbital
      ? {
          orbitUncertainty: toNumber(orbital.orbit_uncertainty),
          orbitClass: typeof orbitClass === 'string' ? orbitClass : null,
        }
      : {}),
  };
}

export function parseAsteroids(raw: unknown): Asteroid[] {
  if (!isRecord(raw) || !isRecord(raw.near_earth_objects)) {
    return [];
  }
  const asteroids: Asteroid[] = [];
  for (const items of Object.values(raw.near_earth_objects)) {
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items) {
      const parsed = parseAsteroidRecord(item);
      if (parsed) {
        asteroids.push(parsed);
      }
    }
  }
  return asteroids;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchAsteroids(fetchFn: FetchFn = fetch, now: Date = new Date()): Promise<Asteroid[]> {
  const date = formatDate(now);
  const url = `${API_BASE}?start_date=${date}&end_date=${date}&api_key=${NASA_API_KEY}`;
  const response = await fetchViaProxy(fetchFn, url);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA NeoWs', response.status, url));
  }
  return parseAsteroids(await response.json());
}

const DAY_MS = 24 * 60 * 60 * 1000;
// NeoWs' feed accepts at most 7 days per request.
const FEED_MAX_DAYS = 7;

/**
 * Every Earth close approach within ±windowDays of `now`, with orbital
 * details (`detailed=true`). Split into ≤7-day feed requests; one failing
 * chunk is tolerated, only an all-chunks failure throws.
 */
export async function fetchFlybys(windowDays: number, fetchFn: FetchFn = fetch, now: Date = new Date()): Promise<Asteroid[]> {
  const start = now.getTime() - windowDays * DAY_MS;
  const totalDays = windowDays * 2 + 1;
  const urls: string[] = [];
  for (let offset = 0; offset < totalDays; offset += FEED_MAX_DAYS) {
    const chunkStart = formatDate(new Date(start + offset * DAY_MS));
    const chunkEnd = formatDate(new Date(start + Math.min(totalDays - 1, offset + FEED_MAX_DAYS - 1) * DAY_MS));
    urls.push(`${API_BASE}?start_date=${chunkStart}&end_date=${chunkEnd}&detailed=true&api_key=${NASA_API_KEY}`);
  }
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetchViaProxy(fetchFn, url);
      if (!response.ok) {
        throw new Error(describeHttpError('NASA NeoWs', response.status, url));
      }
      return parseAsteroids(await response.json());
    }),
  );
  const byId = new Map<string, Asteroid>();
  let firstError: unknown = null;
  for (const result of results) {
    if (result.status === 'rejected') {
      firstError ??= result.reason;
      continue;
    }
    for (const asteroid of result.value) {
      byId.set(`${asteroid.id}:${asteroid.closeApproachDate}`, asteroid);
    }
  }
  if (byId.size === 0 && firstError) {
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }
  return [...byId.values()];
}
