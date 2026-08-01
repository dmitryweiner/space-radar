import type { ApodInfo } from './types';
import { describeHttpError } from './httpError';
import { NASA_API_KEY } from './nasaApiKey';

// NASA Astronomy Picture of the Day. `thumbs=true` returns a thumbnail image
// URL for the days when the "picture" is a video.
const API_URL = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}&thumbs=true`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseApod(raw: unknown): ApodInfo | null {
  if (!isRecord(raw)) {
    return null;
  }
  const date = raw.date;
  const title = raw.title;
  if (typeof date !== 'string' || typeof title !== 'string') {
    return null;
  }
  const mediaType = typeof raw.media_type === 'string' ? raw.media_type : 'image';
  const url = toNullableString(raw.url);
  const imageUrl = mediaType === 'image' ? url : toNullableString(raw.thumbnail_url);
  return {
    date,
    title,
    mediaType,
    imageUrl,
    linkUrl: toNullableString(raw.hdurl) ?? url,
    copyright: toNullableString(raw.copyright),
  };
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchApod(fetchFn: FetchFn = fetch): Promise<ApodInfo> {
  const response = await fetchFn(API_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('NASA APOD', response.status, API_URL));
  }
  const info = parseApod(await response.json());
  if (!info) {
    throw new Error('NASA APOD returned an unexpected response shape.');
  }
  return info;
}
