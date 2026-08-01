import type { LaunchInfo } from './types';
import { describeHttpError } from './httpError';

// Launch Library 2 (The Space Devs): upcoming orbital launches. No API key;
// free tier is rate-limited to 15 requests/hour, so poll sparingly.
const API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=list';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseLaunches(raw: unknown): LaunchInfo[] {
  if (!isRecord(raw) || !Array.isArray(raw.results)) {
    return [];
  }
  const launches: LaunchInfo[] = [];
  for (const item of raw.results) {
    if (!isRecord(item)) {
      continue;
    }
    const id = item.id;
    const name = item.name;
    const net = item.net;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof net !== 'string') {
      continue;
    }
    const status = isRecord(item.status) && typeof item.status.abbrev === 'string' ? item.status.abbrev : '—';
    launches.push({
      id,
      name,
      status,
      net,
      provider: toNullableString(item.lsp_name),
      location: toNullableString(item.location),
    });
  }
  return launches;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchUpcomingLaunches(fetchFn: FetchFn = fetch): Promise<LaunchInfo[]> {
  const response = await fetchFn(API_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('Launch Library', response.status, API_URL));
  }
  return parseLaunches(await response.json());
}
