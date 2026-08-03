import type {
  AuroraSample,
  KpIndexPoint,
  SolarCycleData,
  SolarCyclePoint,
  SolarCyclePrediction,
  SolarWindPoint,
  SpaceWeatherEvent,
} from './types';

const KP_INDEX_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SOLAR_WIND_URL = 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json';
const AURORA_IMAGE_URL = 'https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg';
const GOES_FLARES_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json';
const OBSERVED_CYCLE_URL = 'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json';
const PREDICTED_CYCLE_URL = 'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json';
const OVATION_AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

// The observed series runs back to 1749; keep only the recent tail so the cache
// stays small — 480 months covers the widest (30-year) card horizon.
const OBSERVED_TAIL_MONTHS = 480;

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

// GOES X-ray flare events: array of objects, ISO time tags, flare class in
// `max_class` (e.g. "M3.2"). No source location in this product.
export function parseGoesFlares(raw: unknown): SpaceWeatherEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const events: SpaceWeatherEvent[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const time = item.begin_time;
    if (typeof time !== 'string') {
      continue;
    }
    const satellite = typeof item.satellite === 'number' ? item.satellite : 0;
    events.push({
      kind: 'flare',
      id: `goes${satellite}-${time}`,
      time,
      classType: typeof item.max_class === 'string' ? item.max_class : null,
      sourceLocation: null,
    });
  }
  return events;
}

// SWPC encodes "no value" as -1 in the solar-cycle products.
function toCycleNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

// `time-tag` and `f10.7` contain characters that can't be destructured, so read
// them via string index access (per CLAUDE.md).
export function parseObservedSolarCycle(raw: unknown): SolarCyclePoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: SolarCyclePoint[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item['time-tag'] !== 'string') {
      continue;
    }
    points.push({
      time: item['time-tag'],
      ssn: toCycleNumber(item.ssn),
      smoothedSsn: toCycleNumber(item.smoothed_ssn),
      f107: toCycleNumber(item['f10.7']),
    });
  }
  return points;
}

export function parsePredictedSolarCycle(raw: unknown): SolarCyclePrediction[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: SolarCyclePrediction[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item['time-tag'] !== 'string') {
      continue;
    }
    points.push({
      time: item['time-tag'],
      predictedSsn: toCycleNumber(item.predicted_ssn),
      predictedF107: toCycleNumber(item['predicted_f10.7']),
    });
  }
  return points;
}

// OVATION aurora grid: `coordinates` is [[lon, lat, probabilityPercent], ...]
// on a 1°×1° grid. The vast majority of cells are 0 — drop them so only the
// visible oval is kept.
export function parseAurora(raw: unknown): AuroraSample[] {
  if (!isRecord(raw) || !Array.isArray(raw.coordinates)) {
    return [];
  }
  const samples: AuroraSample[] = [];
  for (const cell of raw.coordinates) {
    if (!Array.isArray(cell) || cell.length < 3) {
      continue;
    }
    const [lon, lat, prob] = cell;
    if (typeof lon !== 'number' || typeof lat !== 'number' || typeof prob !== 'number' || prob <= 0) {
      continue;
    }
    samples.push({ latitude: lat, longitude: lon, probability: prob / 100 });
  }
  return samples;
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

export async function fetchGoesFlares(fetchFn: FetchFn = fetch): Promise<SpaceWeatherEvent[]> {
  const response = await fetchFn(GOES_FLARES_URL);
  if (!response.ok) {
    throw new Error(`NOAA SWPC GOES flares request failed with status ${response.status ?? 'unknown'}`);
  }
  return parseGoesFlares(await response.json());
}

// Observed and predicted series in one resource. The predicted feed is
// best-effort — the observed curve alone is still useful if it fails.
export async function fetchSolarCycle(fetchFn: FetchFn = fetch): Promise<SolarCycleData> {
  const observedResponse = await fetchFn(OBSERVED_CYCLE_URL);
  if (!observedResponse.ok) {
    throw new Error(`NOAA SWPC solar cycle request failed with status ${observedResponse.status ?? 'unknown'}`);
  }
  const observed = parseObservedSolarCycle(await observedResponse.json()).slice(-OBSERVED_TAIL_MONTHS);

  let predicted: SolarCyclePrediction[] = [];
  try {
    const predictedResponse = await fetchFn(PREDICTED_CYCLE_URL);
    if (predictedResponse.ok) {
      predicted = parsePredictedSolarCycle(await predictedResponse.json());
    }
  } catch {
    // Best-effort; keep the observed series.
  }

  return { observed, predicted };
}

export async function fetchAurora(fetchFn: FetchFn = fetch): Promise<AuroraSample[]> {
  const response = await fetchFn(OVATION_AURORA_URL);
  if (!response.ok) {
    throw new Error(`NOAA SWPC OVATION aurora request failed with status ${response.status ?? 'unknown'}`);
  }
  return parseAurora(await response.json());
}

export function auroraForecastImageUrl(): string {
  return AURORA_IMAGE_URL;
}
