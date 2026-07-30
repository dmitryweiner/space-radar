import type { KpIndexPoint, SolarWindPoint } from './types';

const KP_INDEX_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SOLAR_WIND_URL = 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json';
const AURORA_IMAGE_URL = 'https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTable(value: unknown): value is unknown[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row));
}

function toNumber(cell: unknown): number | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? cell : null;
  }
  if (typeof cell === 'string') {
    const parsed = Number(cell);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseKpIndex(raw: unknown): KpIndexPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: KpIndexPoint[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const time = item.time_tag;
    const kp = item.Kp;
    if (typeof time === 'string' && typeof kp === 'number') {
      points.push({ time, kp });
    }
  }
  return points;
}

export function parseSolarWind(raw: unknown): SolarWindPoint[] {
  if (!isTable(raw) || raw.length < 2) {
    return [];
  }
  const [header, ...rows] = raw;
  const timeIdx = header.indexOf('time_tag');
  const speedIdx = header.indexOf('speed');
  const densityIdx = header.indexOf('density');
  const temperatureIdx = header.indexOf('temperature');
  if (timeIdx === -1) {
    return [];
  }

  const points: SolarWindPoint[] = [];
  for (const row of rows) {
    const time = row[timeIdx];
    if (typeof time !== 'string') {
      continue;
    }
    points.push({
      time,
      density: toNumber(row[densityIdx]),
      speed: toNumber(row[speedIdx]),
      temperature: toNumber(row[temperatureIdx]),
    });
  }
  return points;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchKpIndex(fetchFn: FetchFn = fetch): Promise<KpIndexPoint[]> {
  const response = await fetchFn(KP_INDEX_URL);
  if (!response.ok) {
    throw new Error(`NOAA SWPC Kp-index request failed with status ${response.status ?? 'unknown'}`);
  }
  return parseKpIndex(await response.json());
}

export async function fetchSolarWind(fetchFn: FetchFn = fetch): Promise<SolarWindPoint[]> {
  const response = await fetchFn(SOLAR_WIND_URL);
  if (!response.ok) {
    throw new Error(`NOAA SWPC solar wind request failed with status ${response.status ?? 'unknown'}`);
  }
  return parseSolarWind(await response.json());
}

export function auroraForecastImageUrl(): string {
  return AURORA_IMAGE_URL;
}
