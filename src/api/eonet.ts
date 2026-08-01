import type { NaturalEvent } from './types';
import { describeHttpError } from './httpError';

// NASA EONET (Earth Observatory Natural Event Tracker): open natural events
// (wildfires, volcanoes, severe storms, …). No API key required, CORS-open.
const API_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// EONET geometry coordinates are GeoJSON: [lon, lat] for a Point, or nested
// arrays for Polygon/LineString. Dig down to the first numeric [lon, lat] pair.
function firstLonLat(coordinates: unknown): { longitude: number; latitude: number } | null {
  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number' &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return { longitude: coordinates[0], latitude: coordinates[1] };
  }
  if (Array.isArray(coordinates)) {
    for (const nested of coordinates) {
      const found = firstLonLat(nested);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

interface LatestGeometry {
  time: string | null;
  magnitude: string | null;
  latitude: number | null;
  longitude: number | null;
}

function latestGeometry(geometry: unknown): LatestGeometry {
  if (!Array.isArray(geometry) || geometry.length === 0) {
    return { time: null, magnitude: null, latitude: null, longitude: null };
  }
  const last = geometry[geometry.length - 1];
  if (!isRecord(last)) {
    return { time: null, magnitude: null, latitude: null, longitude: null };
  }
  const time = typeof last.date === 'string' ? last.date : null;
  const magnitude =
    typeof last.magnitudeValue === 'number' && typeof last.magnitudeUnit === 'string'
      ? `${last.magnitudeValue} ${last.magnitudeUnit}`
      : null;
  const lonLat = firstLonLat(last.coordinates);
  return { time, magnitude, latitude: lonLat?.latitude ?? null, longitude: lonLat?.longitude ?? null };
}

function firstCategory(categories: unknown): string {
  if (Array.isArray(categories) && categories.length > 0) {
    const first = categories[0];
    if (isRecord(first) && typeof first.title === 'string') {
      return first.title;
    }
  }
  return 'Other';
}

export function parseNaturalEvents(raw: unknown): NaturalEvent[] {
  if (!isRecord(raw) || !Array.isArray(raw.events)) {
    return [];
  }
  const events: NaturalEvent[] = [];
  for (const item of raw.events) {
    if (!isRecord(item)) {
      continue;
    }
    const id = item.id;
    const title = item.title;
    if (typeof id !== 'string' || typeof title !== 'string') {
      continue;
    }
    const { time, magnitude, latitude, longitude } = latestGeometry(item.geometry);
    events.push({ id, title, category: firstCategory(item.categories), time, magnitude, latitude, longitude });
  }
  return events.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchNaturalEvents(fetchFn: FetchFn = fetch): Promise<NaturalEvent[]> {
  const response = await fetchFn(API_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA EONET', response.status, API_URL));
  }
  return parseNaturalEvents(await response.json());
}
