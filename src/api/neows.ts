import type { Asteroid } from './types';
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

  return {
    id,
    name,
    hazardous,
    diameterMinKm,
    diameterMaxKm,
    closeApproachDate,
    missDistanceKm,
    relativeVelocityKmH,
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
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA NeoWs', response.status, url));
  }
  return parseAsteroids(await response.json());
}
