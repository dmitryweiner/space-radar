import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchSpacecraftTrack } from '../api/horizons';
import type { SpacecraftTrack, TrackSample } from '../api/types';
import { earthPositionAt, type HeliocentricVector } from '../astro/planetPositions';
import { DISPLAY_LINEAR_LIMIT_AU, distanceAu } from '../astro/kepler';
import type { SolarMarker, SolarTrack } from '../render/solarSystemScene';
import { listSetting, numberSetting } from '../settings/values';
import { useClock } from './issLayer';
import { isRecord, type SolarFrame, type SolarLayerDefinition } from './types';

interface Spacecraft {
  /** JPL Horizons id. */
  id: string;
  name: string;
  agency: string;
  launched: string;
  mission: string;
  url: string;
  /** Sample spacing: 1 day for fast inner-system craft, coarser out deep. */
  stepDays: number;
}

// Active deep-space missions Horizons has trajectories for (checked Oct 2026).
export const SPACECRAFT: Spacecraft[] = [
  { id: '-31', name: 'Voyager 1', agency: 'NASA', launched: '1977', mission: 'Interstellar space since 2012 — the most distant human-made object.', url: 'https://science.nasa.gov/mission/voyager/voyager-1/', stepDays: 4 },
  { id: '-32', name: 'Voyager 2', agency: 'NASA', launched: '1977', mission: 'Interstellar space since 2018; the only probe to visit Uranus and Neptune.', url: 'https://science.nasa.gov/mission/voyager/voyager-2/', stepDays: 4 },
  { id: '-98', name: 'New Horizons', agency: 'NASA', launched: '2006', mission: 'Flew past Pluto (2015) and Arrokoth (2019); now in the Kuiper Belt.', url: 'https://science.nasa.gov/mission/new-horizons/', stepDays: 4 },
  { id: '-96', name: 'Parker Solar Probe', agency: 'NASA', launched: '2018', mission: 'Dives through the Sun’s corona — the closest and fastest spacecraft ever.', url: 'https://science.nasa.gov/mission/parker-solar-probe/', stepDays: 1 },
  { id: '-144', name: 'Solar Orbiter', agency: 'ESA/NASA', launched: '2020', mission: 'Images the Sun’s poles from an increasingly inclined orbit.', url: 'https://www.esa.int/Science_Exploration/Space_Science/Solar_Orbiter', stepDays: 1 },
  { id: '-121', name: 'BepiColombo', agency: 'ESA/JAXA', launched: '2018', mission: 'Two orbiters on their way to Mercury.', url: 'https://www.esa.int/Science_Exploration/Space_Science/BepiColombo', stepDays: 1 },
  { id: '-61', name: 'Juno', agency: 'NASA', launched: '2011', mission: 'Orbiting Jupiter since 2016.', url: 'https://science.nasa.gov/mission/juno/', stepDays: 2 },
  { id: '-159', name: 'Europa Clipper', agency: 'NASA', launched: '2024', mission: 'Cruising to Jupiter to study Europa’s ice shell and ocean (arrival 2030).', url: 'https://science.nasa.gov/mission/europa-clipper/', stepDays: 2 },
  { id: '-28', name: 'JUICE', agency: 'ESA', launched: '2023', mission: 'Cruising to Jupiter’s icy moons, Ganymede above all (arrival 2031).', url: 'https://www.esa.int/Science_Exploration/Space_Science/Juice', stepDays: 2 },
  { id: '-255', name: 'Psyche', agency: 'NASA', launched: '2023', mission: 'On its way to the metal-rich asteroid 16 Psyche (arrival 2029).', url: 'https://science.nasa.gov/mission/psyche/', stepDays: 2 },
  { id: '-49', name: 'Lucy', agency: 'NASA', launched: '2021', mission: 'Touring Jupiter’s Trojan asteroids.', url: 'https://science.nasa.gov/mission/lucy/', stepDays: 2 },
  { id: '-64', name: 'OSIRIS-APEX', agency: 'NASA', launched: '2016', mission: 'After returning Bennu samples (2023), heading for asteroid Apophis (2029).', url: 'https://science.nasa.gov/mission/osiris-apex/', stepDays: 2 },
  { id: '-170', name: 'JWST', agency: 'NASA/ESA/CSA', launched: '2021', mission: 'Space telescope orbiting the Sun–Earth L2 point, 1.5 million km from Earth.', url: 'https://science.nasa.gov/mission/webb/', stepDays: 2 },
];

const BY_ID = new Map(SPACECRAFT.map((craft) => [craft.id, craft]));
const ALL_IDS = SPACECRAFT.map((craft) => craft.id);

const COLOR = 0x7ee787;
const DAY_MS = 24 * 60 * 60 * 1000;
// A year of history for trails; two weeks ahead covers the ±7 d scrubber.
const HISTORY_DAYS = 365;
const FUTURE_DAYS = 14;
const CONCURRENCY = 2;
const LIVE_TICK_MS = 60 * 1000;
const DEFAULT_TRAIL_DAYS = 180;
const AU_KM = 149_597_870.7;
const LIGHT_SECONDS_PER_AU = 499.005;

interface SpacecraftData {
  tracks: SpacecraftTrack[];
  /** Names of craft Horizons had nothing for. */
  failed: string[];
}

function isSamples(value: unknown): value is TrackSample[] {
  return (
    Array.isArray(value) &&
    value.every((s) => isRecord(s) && typeof s.ms === 'number' && typeof s.xAu === 'number' && typeof s.yAu === 'number' && typeof s.zAu === 'number')
  );
}

function isSpacecraftData(value: unknown): value is SpacecraftData {
  return (
    isRecord(value) &&
    Array.isArray(value.failed) &&
    value.failed.every((name) => typeof name === 'string') &&
    Array.isArray(value.tracks) &&
    value.tracks.every((track) => isRecord(track) && typeof track.id === 'string' && isSamples(track.samples))
  );
}

// Horizons asks callers not to hammer it: a few requests at a time, and the
// date range is whole days so the proxy serves everyone the same cached copy.
async function fetchAllSpacecraft(): Promise<SpacecraftData> {
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const start = today - HISTORY_DAYS * DAY_MS;
  const stop = today + FUTURE_DAYS * DAY_MS;
  const tracks: SpacecraftTrack[] = [];
  const failed: string[] = [];
  let firstError: unknown = null;
  for (let i = 0; i < SPACECRAFT.length; i += CONCURRENCY) {
    const batch = SPACECRAFT.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((craft) => fetchSpacecraftTrack(craft, start, stop)));
    results.forEach((result, k) => {
      if (result.status === 'fulfilled') {
        tracks.push(result.value);
      } else {
        firstError ??= result.reason;
        failed.push(batch[k].name);
      }
    });
  }
  if (tracks.length === 0) {
    throw firstError instanceof Error ? firstError : new Error('JPL Horizons unavailable');
  }
  return { tracks, failed };
}

/** Linear interpolation between the samples around `ms`; null outside them. */
export function positionAt(samples: TrackSample[], ms: number): HeliocentricVector | null {
  if (samples.length === 0 || ms < samples[0].ms || ms > samples[samples.length - 1].ms) {
    return null;
  }
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].ms <= ms) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = b.ms === a.ms ? 0 : (ms - a.ms) / (b.ms - a.ms);
  return {
    xAu: a.xAu + (b.xAu - a.xAu) * t,
    yAu: a.yAu + (b.yAu - a.yAu) * t,
    zAu: a.zAu + (b.zAu - a.zAu) * t,
  };
}

/** Samples from `ms − spanMs` up to the interpolated position at `ms`. */
export function trailUntil(samples: TrackSample[], ms: number, spanMs: number): HeliocentricVector[] {
  const head = positionAt(samples, ms);
  if (!head) {
    return [];
  }
  const points: HeliocentricVector[] = samples.filter((s) => s.ms >= ms - spanMs && s.ms < ms);
  points.push(head);
  return points;
}

function speedKmS(samples: TrackSample[], ms: number): number | null {
  const a = positionAt(samples, ms - DAY_MS / 2);
  const b = positionAt(samples, ms + DAY_MS / 2);
  return a && b ? (distanceAu(a, b) * AU_KM) / 86_400 : null;
}

function formatLightTime(au: number): string {
  const seconds = au * LIGHT_SECONDS_PER_AU;
  if (seconds < 120) return `${Math.round(seconds)} s`;
  if (seconds < 7200) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

export const spacecraftLayer: SolarLayerDefinition = {
  id: 'spacecraft',
  title: 'Spacecraft',
  color: '#7ee787',
  settings: [
    {
      kind: 'multiselect',
      id: 'craft',
      label: 'Spacecraft',
      options: SPACECRAFT.map((craft) => ({ value: craft.id, label: craft.name })),
      defaultValue: ALL_IDS,
    },
    { kind: 'number', id: 'trailDays', label: 'Trail (days)', min: 30, max: 360, step: 30, defaultValue: DEFAULT_TRAIL_DAYS },
  ],
  useLayer(settings, time) {
    // A module-level fallback: a fresh array per render would re-run every memo.
    const selected = listSetting(settings, 'craft', ALL_IDS);
    const trailDays = numberSetting(settings, 'trailDays', DEFAULT_TRAIL_DAYS);
    const { data, loading, error } = useApiResource<SpacecraftData>({
      key: 'space-radar:spacecraft:v1',
      ttlMs: 12 * 60 * 60 * 1000,
      pollMs: 6 * 60 * 60 * 1000,
      fetcher: fetchAllSpacecraft,
      isValue: isSpacecraftData,
    });
    const nowMs = useClock(time, LIVE_TICK_MS);

    const shown = useMemo(
      () => (data?.tracks ?? []).filter((track) => selected.includes(track.id) && BY_ID.has(track.id)),
      [data, selected],
    );

    const frame = useMemo<SolarFrame>(() => {
      const markers: SolarMarker[] = [];
      const tracks: SolarTrack[] = [];
      for (const track of shown) {
        const position = positionAt(track.samples, nowMs);
        if (!position) {
          continue;
        }
        markers.push({
          id: track.id,
          position,
          color: COLOR,
          label: BY_ID.get(track.id)?.name ?? track.id,
          shape: 'diamond',
          labelAlways: true,
        });
        tracks.push({ id: track.id, points: trailUntil(track.samples, nowMs, trailDays * DAY_MS), color: COLOR, fade: true });
      }
      return { markers, tracks };
    }, [shown, nowMs, trailDays]);

    const far = shown.filter((track) => {
      const p = positionAt(track.samples, nowMs);
      return p && Math.hypot(p.xAu, p.yAu, p.zAu) > DISPLAY_LINEAR_LIMIT_AU;
    }).length;
    const missing = data?.failed.length ? ` · ${data.failed.length} unavailable` : '';

    return {
      frame,
      loading,
      error,
      summary: data
        ? `${frame.markers?.length ?? 0} spacecraft (JPL Horizons)${far ? ` · ${far} beyond ${DISPLAY_LINEAR_LIMIT_AU} AU — zoom out; distances there are compressed` : ''}${missing}`
        : null,
      legend: [{ label: 'Spacecraft · trail = last months', color: '#7ee787' }],
      describe(hit) {
        if (hit.kind !== 'marker') return null;
        const craft = BY_ID.get(hit.id);
        const track = shown.find((t) => t.id === hit.id);
        const position = track ? positionAt(track.samples, nowMs) : null;
        if (!craft || !track || !position) return null;
        const fromSun = Math.hypot(position.xAu, position.yAu, position.zAu);
        const fromEarth = distanceAu(position, earthPositionAt(new Date(nowMs)));
        const speed = speedKmS(track.samples, nowMs);
        return {
          title: craft.name,
          fields: [
            { label: 'Mission', value: craft.mission },
            { label: 'Agency · launched', value: `${craft.agency} · ${craft.launched}` },
            { label: 'From the Sun', value: `${fromSun.toFixed(fromSun < 10 ? 3 : 1)} AU` },
            { label: 'From Earth', value: `${fromEarth.toFixed(fromEarth < 10 ? 3 : 1)} AU · light ${formatLightTime(fromEarth)}` },
            ...(speed !== null ? [{ label: 'Speed (vs Sun)', value: `${speed.toFixed(1)} km/s` }] : []),
          ],
          detailUrl: craft.url,
        };
      },
    };
  },
};
