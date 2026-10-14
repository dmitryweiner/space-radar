import { useApiResource } from './useApiResource';
import { fetchKpIndex, fetchNoaaScales, fetchSolarWind } from '../api/swpc';
import { fetchPeopleInSpace, fetchUpcomingLaunches } from '../api/launchLibrary';
import type { KpIndexPoint, LaunchInfo, NoaaScales, PeopleInSpace, SolarWindPoint } from '../api/types';

// Resources used by more than one component (a dashboard card *and* the Scene
// view's status bar/inspector). Defined once so every consumer shares one
// cache key, TTL and validator — useApiResource then dedups their requests.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isKpIndexPoints(value: unknown): value is KpIndexPoint[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.time === 'string' && typeof item.kp === 'number');
}

function isSolarWindPoints(value: unknown): value is SolarWindPoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.time === 'string' &&
        isNullableNumber(item.density) &&
        isNullableNumber(item.speed) &&
        isNullableNumber(item.temperature),
    )
  );
}

function isLaunches(value: unknown): value is LaunchInfo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.status === 'string' &&
        typeof item.net === 'string' &&
        isNullableString(item.provider) &&
        isNullableString(item.location) &&
        isNullableString(item.detailUrl),
    )
  );
}

function isNoaaScales(value: unknown): value is NoaaScales {
  return (
    isRecord(value) &&
    typeof value.r === 'number' &&
    typeof value.s === 'number' &&
    typeof value.g === 'number' &&
    typeof value.observedAt === 'string'
  );
}

function isPeopleInSpace(value: unknown): value is PeopleInSpace {
  return (
    isRecord(value) &&
    typeof value.count === 'number' &&
    Array.isArray(value.people) &&
    value.people.every((p) => isRecord(p) && typeof p.name === 'string' && isNullableString(p.agency))
  );
}

export function useKpIndex() {
  return useApiResource<KpIndexPoint[]>({
    key: 'space-radar:kp-index',
    ttlMs: 5 * MINUTE,
    pollMs: 5 * MINUTE,
    fetcher: () => fetchKpIndex(),
    isValue: isKpIndexPoints,
  });
}

export function useSolarWind() {
  return useApiResource<SolarWindPoint[]>({
    key: 'space-radar:solar-wind',
    ttlMs: 5 * MINUTE,
    pollMs: 5 * MINUTE,
    fetcher: () => fetchSolarWind(),
    isValue: isSolarWindPoints,
  });
}

// Launch Library's free tier allows only 15 requests/hour — poll slowly.
export function useLaunches() {
  return useApiResource<LaunchInfo[]>({
    key: 'space-radar:launches',
    ttlMs: HOUR,
    pollMs: HOUR,
    fetcher: () => fetchUpcomingLaunches(),
    isValue: isLaunches,
  });
}

export function usePeopleInSpace() {
  return useApiResource<PeopleInSpace>({
    key: 'space-radar:people-in-space',
    ttlMs: 6 * HOUR,
    pollMs: 6 * HOUR,
    fetcher: () => fetchPeopleInSpace(),
    isValue: isPeopleInSpace,
  });
}

export function useNoaaScales() {
  return useApiResource<NoaaScales>({
    key: 'space-radar:noaa-scales',
    ttlMs: 10 * MINUTE,
    pollMs: 10 * MINUTE,
    fetcher: () => fetchNoaaScales(),
    isValue: isNoaaScales,
  });
}
