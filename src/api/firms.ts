import type { FirePoint } from './types';
import { describeHttpError } from './httpError';
import { FIRMS_MAP_KEY } from './firmsMapKey';

const API_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
// Cap rendered points to protect the WebGL point cloud and keep the CSV
// download reasonable; when the feed has more, we subsample evenly.
const MAX_POINTS = 6000;

function normalizeConfidence(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'l') return 0.25;
  if (trimmed === 'n') return 0.6;
  if (trimmed === 'h') return 0.9;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric / 100)) : null;
}

// FIRMS area CSV is a plain header + rows, columns varying by source (VIIRS
// uses `bright_ti4`, MODIS uses `brightness`). Read columns by header name.
export function parseFirmsCsv(text: string): FirePoint[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    return [];
  }
  const header = lines[0].split(',').map((cell) => cell.trim());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  if (latIdx === -1 || lonIdx === -1) {
    return [];
  }

  const rows = lines.slice(1);
  const step = rows.length > MAX_POINTS ? Math.ceil(rows.length / MAX_POINTS) : 1;
  const points: FirePoint[] = [];
  for (let i = 0; i < rows.length; i += step) {
    const cells = rows[i].split(',');
    const latitude = Number(cells[latIdx]);
    const longitude = Number(cells[lonIdx]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const brightness = brightIdx !== -1 ? Number(cells[brightIdx]) : NaN;
    const date = dateIdx !== -1 ? (cells[dateIdx] ?? '').trim() : '';
    const time = timeIdx !== -1 ? (cells[timeIdx] ?? '').trim() : '';
    points.push({
      latitude,
      longitude,
      brightnessKelvin: Number.isFinite(brightness) ? brightness : 0,
      confidence: confIdx !== -1 ? normalizeConfidence(cells[confIdx] ?? '') : null,
      acquiredAt: [date, time].filter(Boolean).join(' '),
    });
  }
  return points;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  text(): Promise<string>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export interface FirmsOptions {
  source?: string;
  /** 'world' or a bounding box "west,south,east,north". */
  area?: string;
  dayRange?: number;
}

export async function fetchFirePoints(fetchFn: FetchFn = fetch, options: FirmsOptions = {}): Promise<FirePoint[]> {
  if (!FIRMS_MAP_KEY) {
    throw new Error('Add your FIRMS MAP_KEY in src/api/firmsMapKey.ts to load fire detections.');
  }
  const source = options.source ?? 'VIIRS_SNPP_NRT';
  const area = options.area ?? 'world';
  const dayRange = options.dayRange ?? 1;
  const url = `${API_BASE}/${FIRMS_MAP_KEY}/${source}/${area}/${dayRange}`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA FIRMS', response.status, url));
  }
  const text = await response.text();
  // On some errors FIRMS returns HTTP 200 with a plain-text message body
  // ("Invalid MAP_KEY.", quota messages) rather than CSV — surface it verbatim.
  if (!text.toLowerCase().includes('latitude')) {
    throw new Error(`NASA FIRMS: ${text.trim().slice(0, 120) || 'unexpected response'}`);
  }
  return parseFirmsCsv(text);
}
