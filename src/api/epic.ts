import type { EpicFrame } from './types';
import { describeHttpError } from './httpError';

// DSCOVR/EPIC natural-colour full-disk Earth images from the L1 point. Direct
// host (not api.nasa.gov) so no key is needed and it sends CORS `*`.
const API_URL = 'https://epic.gsfc.nasa.gov/api/natural';
const ARCHIVE_BASE = 'https://epic.gsfc.nasa.gov/archive/natural';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// The image's date/time string ("YYYY-MM-DD hh:mm:ss") selects the archive
// sub-path, which is organised as .../YYYY/MM/DD/jpg/<image>.jpg.
export function epicImageUrl(image: string, date: string): string {
  const datePart = date.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${ARCHIVE_BASE}/${year}/${month}/${day}/jpg/${image}.jpg`;
}

export function parseEpic(raw: unknown): EpicFrame[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const frames: EpicFrame[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const { image, date } = item;
    if (typeof image !== 'string' || typeof date !== 'string') {
      continue;
    }
    const centroid = isRecord(item.centroid_coordinates) ? item.centroid_coordinates : null;
    frames.push({
      image,
      date,
      imageUrl: epicImageUrl(image, date),
      centroidLat: centroid ? toNullableNumber(centroid.lat) : null,
      centroidLon: centroid ? toNullableNumber(centroid.lon) : null,
    });
  }
  return frames;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchEpic(fetchFn: FetchFn = fetch): Promise<EpicFrame[]> {
  const response = await fetchFn(API_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA EPIC', response.status, API_URL));
  }
  return parseEpic(await response.json());
}
