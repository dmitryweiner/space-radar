import type { LaunchInfo, PeopleInSpace } from './types';
import { fetchViaProxy } from './proxy';
import { describeHttpError } from './httpError';

// Launch Library 2 (The Space Devs): upcoming orbital launches. No API key;
// free tier is rate-limited to 15 requests/hour, so poll sparingly.
const API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=list';
// Shares the same 15/hour budget — poll no faster than hourly.
const ASTRONAUTS_URL = 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=50&mode=list';

// The API's own `url` field is the JSON detail endpoint, not a page for
// people — spacelaunchnow.me is The Space Devs' companion site for this same
// data and resolves human-readable pages at this path (verified via curl).
function detailUrl(slug: string | null): string | null {
  return slug ? `https://spacelaunchnow.me/launch/${slug}` : null;
}

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
      detailUrl: detailUrl(toNullableString(item.slug)),
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
  const response = await fetchViaProxy(fetchFn, API_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('Launch Library', response.status, API_URL));
  }
  return parseLaunches(await response.json());
}

// `astronaut/?in_space=true`: `count` is the total; each result has a `name`
// and an `agency` object (`abbrev`/`name`). Agency is optional in list mode.
export function parsePeopleInSpace(raw: unknown): PeopleInSpace | null {
  if (!isRecord(raw) || !Array.isArray(raw.results)) {
    return null;
  }
  const people: PeopleInSpace['people'] = [];
  for (const item of raw.results) {
    if (!isRecord(item) || typeof item.name !== 'string') {
      continue;
    }
    const agency = isRecord(item.agency) ? (toNullableString(item.agency.abbrev) ?? toNullableString(item.agency.name)) : null;
    people.push({ name: item.name, agency });
  }
  const count = typeof raw.count === 'number' ? raw.count : people.length;
  return { count, people };
}

export async function fetchPeopleInSpace(fetchFn: FetchFn = fetch): Promise<PeopleInSpace> {
  const response = await fetchViaProxy(fetchFn, ASTRONAUTS_URL);
  if (!response.ok) {
    throw new Error(describeHttpError('Launch Library', response.status, ASTRONAUTS_URL));
  }
  const people = parsePeopleInSpace(await response.json());
  if (!people) {
    throw new Error('Launch Library returned an unexpected astronaut response.');
  }
  return people;
}
