import type { NaturalEvent } from './types';
import { describeHttpError } from './httpError';

// NASA EONET (Earth Observatory Natural Event Tracker): open natural events
// (wildfires, volcanoes, severe storms, …). No API key required, CORS-open.
const API_BASE = 'https://eonet.gsfc.nasa.gov/api/v3/events';

// EONET sorts events by most-recent geometry date, and open wildfire events —
// which come mostly from the US-only InciWeb source — dominate that list, so a
// single unfiltered request comes back looking US-only. Fetching per category
// (no `days` filter, so long-running events like volcanoes still surface) and
// merging gives genuinely global coverage. Categories with no current events
// simply return nothing.
const CATEGORIES = [
  'wildfires',
  'volcanoes',
  'severeStorms',
  'seaLakeIce',
  'floods',
  'drought',
  'dustHaze',
  'landslides',
  'earthquakes',
] as const;
const PER_CATEGORY_LIMIT = 60;

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

async function fetchCategory(fetchFn: FetchFn, category: string): Promise<NaturalEvent[]> {
  const url = `${API_BASE}?status=open&category=${category}&limit=${PER_CATEGORY_LIMIT}`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA EONET', response.status, url));
  }
  return parseNaturalEvents(await response.json());
}

export async function fetchNaturalEvents(fetchFn: FetchFn = fetch): Promise<NaturalEvent[]> {
  const settled = await Promise.allSettled(CATEGORIES.map((category) => fetchCategory(fetchFn, category)));

  const fulfilled = settled.filter((result) => result.status === 'fulfilled');
  // Only fail if *every* category request failed (EONET down); a single
  // category erroring shouldn't blank the whole map.
  if (fulfilled.length === 0) {
    const firstRejection = settled.find((result) => result.status === 'rejected');
    throw firstRejection?.reason ?? new Error('NASA EONET: request failed');
  }

  const byId = new Map<string, NaturalEvent>();
  for (const result of fulfilled) {
    for (const event of result.value) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
}
