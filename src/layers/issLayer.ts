import { useEffect, useMemo, useState } from 'react';
import { computeSatellitePosition } from '../astro/satellitePosition';
import { geodeticToSceneVector, type SceneVector3 } from '../astro/coords';
import { EARTH_RADIUS_UNITS, type NamedPosition } from '../render/earthScene';
import type { TleRecord } from '../api/types';
import { listSetting, numberSetting } from '../layout/layoutState';
import { useTleSatellites } from './useTleSatellites';
import type { LayerDefinition, LayerFrame, MarkerDetails } from './types';

const POSITION_UPDATE_MS = 1000;
// The fading orbit trail behind each satellite: a ~40-minute arc (≈0.4 of a LEO
// orbit) sampled at a handful of points, recomputed each tick so it follows.
const TRAIL_SAMPLES = 20;
const TRAIL_SPAN_MS = 40 * 60 * 1000;

const DEFAULT_CATEGORIES = ['stations'];
const DEFAULT_MAX_SATELLITES = 30;

// Curated CelesTrak GP groups; see https://celestrak.org/NORAD/elements/.
export const SATELLITE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'stations', label: 'Space stations & nearby' },
  { value: 'visual', label: 'Brightest / visible' },
  { value: 'active', label: 'All active' },
  { value: 'starlink', label: 'Starlink' },
  { value: 'oneweb', label: 'OneWeb' },
  { value: 'gps-ops', label: 'GPS' },
  { value: 'galileo', label: 'Galileo' },
  { value: 'weather', label: 'Weather' },
  { value: 'noaa', label: 'NOAA' },
  { value: 'science', label: 'Science' },
  { value: 'amateur', label: 'Amateur radio' },
];

export function findIss(records: TleRecord[]): TleRecord | null {
  return records.find((record) => /zarya|\biss\b/i.test(record.name)) ?? null;
}

// TLE line 1 format: "1 NNNNNU ..." — the NORAD catalog number is the 5-digit
// field right after the line number.
function noradCatalogNumber(line1: string): string | null {
  return line1.match(/^1\s+(\d+)/)?.[1] ?? null;
}

function satelliteDetails(record: TleRecord): MarkerDetails {
  const noradId = noradCatalogNumber(record.line1);
  return {
    title: record.name,
    fields: noradId ? [{ label: 'NORAD ID', value: noradId }] : [],
    detailUrl: noradId ? `https://www.n2yo.com/satellite/?s=${noradId}` : null,
  };
}

function toScene(record: TleRecord, at: Date): SceneVector3 | null {
  const position = computeSatellitePosition(record, at);
  return position
    ? geodeticToSceneVector(position.latitudeDeg, position.longitudeDeg, position.altitudeKm, EARTH_RADIUS_UNITS)
    : null;
}

// Positions from `atMs` backward over TRAIL_SPAN_MS, ordered tail → head so the
// last point is the satellite's position at `atMs` (the bright end).
export function sampleTrail(tle: TleRecord, atMs: number): SceneVector3[] {
  const points: SceneVector3[] = [];
  for (let i = TRAIL_SAMPLES - 1; i >= 0; i -= 1) {
    const point = toScene(tle, new Date(atMs - (i / (TRAIL_SAMPLES - 1)) * TRAIL_SPAN_MS));
    if (point) {
      points.push(point);
    }
  }
  return points;
}

function positionsAt(records: TleRecord[], atMs: number): NamedPosition[] {
  const points: NamedPosition[] = [];
  const at = new Date(atMs);
  for (const record of records) {
    const position = toScene(record, at);
    if (position) {
      points.push({ name: record.name, position, trail: sampleTrail(record, atMs) });
    }
  }
  return points;
}

// Ticks once a second while live; frozen at the scrubbed instant otherwise.
export function useClock(time: number | null, intervalMs: number): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (time !== null) {
      return undefined;
    }
    const interval = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [time, intervalMs]);
  return time ?? tick;
}

export const issLayer: LayerDefinition = {
  id: 'iss',
  title: 'ISS & satellites',
  color: '#fab219',
  settings: [
    {
      kind: 'multiselect',
      id: 'categories',
      label: 'Satellite groups',
      options: SATELLITE_CATEGORIES,
      defaultValue: DEFAULT_CATEGORIES,
    },
    { kind: 'number', id: 'maxSatellites', label: 'Max satellites', min: 10, max: 300, step: 10, defaultValue: DEFAULT_MAX_SATELLITES },
  ],
  useLayer(settings, time) {
    const categories = listSetting(settings, 'categories', DEFAULT_CATEGORIES);
    const maxSatellites = numberSetting(settings, 'maxSatellites', DEFAULT_MAX_SATELLITES);
    const { data, loading, error } = useTleSatellites(categories);
    const nowMs = useClock(time, POSITION_UPDATE_MS);

    const iss = useMemo(() => (data ? findIss(data) : null), [data]);
    const others = useMemo(() => {
      const rest = data && iss ? data.filter((record) => record !== iss) : (data ?? []);
      return rest.slice(0, maxSatellites);
    }, [data, iss, maxSatellites]);

    // No frame at all until TLEs arrive — pushing an empty/null frame first
    // would make the scene flash an empty state on every mount.
    const frame = useMemo<LayerFrame>(() => {
      if (!data) {
        return {};
      }
      const issPosition = iss ? toScene(iss, new Date(nowMs)) : null;
      return {
        iss: iss && issPosition ? { position: issPosition, trail: sampleTrail(iss, nowMs) } : null,
        satellites: positionsAt(others, nowMs),
      };
    }, [data, iss, others, nowMs]);

    const count = others.length + (iss ? 1 : 0);
    return {
      frame,
      loading,
      error,
      summary: data ? `${count} satellite${count === 1 ? '' : 's'}` : null,
      legend: [],
      describe(hit) {
        const record =
          hit.kind === 'iss' ? iss : hit.kind === 'satellite' ? (data?.find((r) => r.name === hit.name) ?? null) : null;
        return record ? satelliteDetails(record) : null;
      },
    };
  },
};
