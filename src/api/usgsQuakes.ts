import type { Quake } from './types';

// USGS realtime earthquake GeoJSON feeds — no key, CORS `*`, updated every
// minute. Each option is a magnitude-threshold × time-window combination and
// maps to its own feed URL; selecting several fetches and merges them.
const FEED_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';

export interface QuakeFeedOption {
  value: string;
  label: string;
}

export const QUAKE_FEEDS: QuakeFeedOption[] = [
  { value: '2.5_day', label: 'M2.5+ · past day' },
  { value: '4.5_week', label: 'M4.5+ · past week' },
  { value: '1.0_day', label: 'M1.0+ · past day' },
  { value: 'significant_week', label: 'Significant · past week' },
];

const ALLOWED_FEEDS = new Set(QUAKE_FEEDS.map((feed) => feed.value));

export function quakeFeedUrl(feed: string): string {
  return `${FEED_BASE}/${feed}.geojson`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// One GeoJSON FeatureCollection → typed quakes. Coordinates are [lon, lat,
// depthKm]; magnitude/place/time live under `properties`.
export function parseQuakes(raw: unknown): Quake[] {
  if (!isRecord(raw) || !Array.isArray(raw.features)) {
    return [];
  }
  const quakes: Quake[] = [];
  for (const feature of raw.features) {
    if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) {
      continue;
    }
    const coords = feature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      continue;
    }
    const [lon, lat, depth] = coords;
    const props = feature.properties;
    if (typeof feature.id !== 'string' || typeof props.mag !== 'number' || typeof lon !== 'number' || typeof lat !== 'number') {
      continue;
    }
    quakes.push({
      id: feature.id,
      magnitude: props.mag,
      place: typeof props.place === 'string' ? props.place : 'Unknown location',
      time: typeof props.time === 'number' ? props.time : 0,
      latitude: lat,
      longitude: lon,
      depthKm: typeof depth === 'number' ? depth : 0,
      url: typeof props.url === 'string' ? props.url : '',
    });
  }
  return quakes;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

// Fetch every selected feed in parallel, merge, and dedup by event id (feeds
// overlap — e.g. an M5 shows up in both M2.5+ and M4.5+). One failing feed is
// tolerated; only an all-failing selection throws.
export async function fetchQuakes(feeds: string[], fetchFn: FetchFn = fetch): Promise<Quake[]> {
  const selected = feeds.filter((feed) => ALLOWED_FEEDS.has(feed));
  const effective = selected.length > 0 ? selected : ['2.5_day'];

  const results = await Promise.allSettled(
    effective.map(async (feed) => {
      const response = await fetchFn(quakeFeedUrl(feed));
      if (!response.ok) {
        throw new Error(`USGS quakes feed "${feed}" failed with status ${response.status ?? 'unknown'}`);
      }
      return parseQuakes(await response.json());
    }),
  );

  const byId = new Map<string, Quake>();
  let anyFulfilled = false;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      anyFulfilled = true;
      for (const quake of result.value) {
        byId.set(quake.id, quake);
      }
    }
  }
  if (!anyFulfilled) {
    throw new Error('USGS earthquake feeds are unavailable.');
  }
  return [...byId.values()].sort((a, b) => b.time - a.time);
}
