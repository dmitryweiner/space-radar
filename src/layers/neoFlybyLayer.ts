import { useMemo } from 'react';
import { useFlybys } from '../hooks/sharedResources';
import type { Asteroid } from '../api/types';
import {
  compressedSceneVector,
  flybyOffsetKm,
  lunarDistances,
  MOON_DISTANCE_KM,
  type FlybyApproach,
  type Vec3,
} from '../astro/flyby';
import { geodeticToSceneVector, type SceneVector3 } from '../astro/coords';
import { sublunarPoint } from '../astro/subsolar';
import { EARTH_RADIUS_UNITS, type GlobeMarker, type GlobeTrack } from '../render/earthScene';
import { numberSetting } from '../settings/values';
import { useClock } from './issLayer';
import type { LayerDefinition, LayerFrame } from './types';
import { formatDiameter, formatDistance, formatSpeed, formatTime } from '../format/display';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MAX_OBJECTS = 15;
// Positions move ~10 km/s — at this scale a 10 s refresh is visually smooth.
const LIVE_TICK_MS = 10 * 1000;
const PATH_SAMPLES = 64;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SAFE_COLOR = 0x9fd8ff;
const HAZARD_COLOR = 0xff4d4d;
const MOON_COLOR = 0xcfd4e0;
export const MOON_MARKER_ID = 'moon';

export interface Flyby extends FlybyApproach {
  asteroid: Asteroid;
}

function toFlyby(asteroid: Asteroid): Flyby | null {
  const closeApproachMs = asteroid.closeApproachMs ?? Date.parse(asteroid.closeApproachDate);
  if (!Number.isFinite(closeApproachMs)) {
    return null;
  }
  return {
    id: asteroid.id,
    closeApproachMs,
    missDistanceKm: asteroid.missDistanceKm,
    speedKmS: asteroid.relativeVelocityKmH / 3600,
    asteroid,
  };
}

// NeoWs lists some objects twice — a provisional record "(2018 EH4)" and a
// numbered one "678976 (2018 EH4)", with different ids but the same pass.
// Keep one per designation + approach hour, preferring the numbered record.
export function dedupeFlybys<T extends { closeApproachMs: number; asteroid: { name: string } }>(flybys: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const flyby of flybys) {
    const key = `${shortName(flyby.asteroid.name)}@${Math.round(flyby.closeApproachMs / HOUR_MS)}`;
    const existing = byKey.get(key);
    if (!existing || (/^\d/.test(flyby.asteroid.name) && !/^\d/.test(existing.asteroid.name))) {
      byKey.set(key, flyby);
    }
  }
  return [...byKey.values()];
}

/** The closest passes in the window — the ones worth looking at. */
export function closestFlybys(asteroids: Asteroid[], max: number): Flyby[] {
  return dedupeFlybys(asteroids.map(toFlyby).filter((f): f is Flyby => f !== null))
    .sort((a, b) => a.missDistanceKm - b.missDistanceKm)
    .slice(0, max);
}

function toScene(km: Vec3): SceneVector3 {
  return compressedSceneVector(km, EARTH_RADIUS_UNITS);
}

export function relativeTime(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const text = abs >= DAY_MS ? `${(abs / DAY_MS).toFixed(1)} d` : `${Math.max(1, Math.round(abs / HOUR_MS))} h`;
  return deltaMs >= 0 ? `in ${text}` : `${text} ago`;
}

export function shortName(name: string): string {
  // NeoWs names look like "(2016 UZ41)" or "678976 (2018 EH4)".
  return name.replace(/^\d+\s+/, '').replace(/[()]/g, '');
}

// The Moon at its real direction (sub-lunar point) on the compressed scale,
// plus a ring through it for scale.
function moonGeometry(atMs: number): { marker: GlobeMarker; ring: GlobeTrack } {
  const sub = sublunarPoint(new Date(atMs));
  const radius = toScene({ x: MOON_DISTANCE_KM, y: 0, z: 0 }).x;
  const position = geodeticToSceneVector(sub.latitudeDeg, sub.longitudeDeg, 0, radius);
  // Ring in the plane through the Moon and the horizontal direction ⟂ it.
  const m = { x: position.x / radius, y: position.y / radius, z: position.z / radius };
  const h0 = { x: -m.z, y: 0, z: m.x };
  const hl = Math.hypot(h0.x, h0.z) || 1;
  const h = { x: h0.x / hl, y: 0, z: h0.z / hl };
  const points: SceneVector3[] = [];
  for (let i = 0; i <= 96; i += 1) {
    const a = (i / 96) * Math.PI * 2;
    points.push({
      x: radius * (m.x * Math.cos(a) + h.x * Math.sin(a)),
      y: radius * (m.y * Math.cos(a) + h.y * Math.sin(a)),
      z: radius * (m.z * Math.cos(a) + h.z * Math.sin(a)),
    });
  }
  return {
    marker: { id: MOON_MARKER_ID, position, color: MOON_COLOR, label: 'Moon' },
    ring: { id: 'moon-orbit', points, color: MOON_COLOR, opacity: 0.25 },
  };
}

export const neoFlybyLayer: LayerDefinition = {
  id: 'neo-flyby',
  title: 'Asteroid flybys',
  color: '#ff4d4d',
  settings: [
    { kind: 'number', id: 'windowDays', label: 'Window (± days)', min: 1, max: 21, defaultValue: DEFAULT_WINDOW_DAYS },
    { kind: 'number', id: 'maxObjects', label: 'Closest objects shown', min: 3, max: 50, defaultValue: DEFAULT_MAX_OBJECTS },
  ],
  useLayer(settings, time) {
    const windowDays = numberSetting(settings, 'windowDays', DEFAULT_WINDOW_DAYS);
    const maxObjects = numberSetting(settings, 'maxObjects', DEFAULT_MAX_OBJECTS);
    const { data, loading, error } = useFlybys(windowDays);
    const nowMs = useClock(time, LIVE_TICK_MS);

    const flybys = useMemo(() => closestFlybys(data ?? [], maxObjects), [data, maxObjects]);

    // Paths only change with the data, so they're memoized separately and
    // setTracks skips the unchanged array on every position tick.
    const paths = useMemo<GlobeTrack[]>(
      () =>
        flybys.map((flyby) => {
          const points: SceneVector3[] = [];
          const span = windowDays * DAY_MS;
          for (let i = 0; i <= PATH_SAMPLES; i += 1) {
            const t = flyby.closeApproachMs - span + (2 * span * i) / PATH_SAMPLES;
            points.push(toScene(flybyOffsetKm(flyby, t)));
          }
          return {
            id: flyby.id,
            points,
            color: flyby.asteroid.hazardous ? HAZARD_COLOR : SAFE_COLOR,
            opacity: 0.35,
          };
        }),
      [flybys, windowDays],
    );

    // The Moon barely moves between ticks; recompute it hourly (or per scrub).
    const moonHour = Math.floor(nowMs / HOUR_MS);
    const moon = useMemo(() => moonGeometry(moonHour * HOUR_MS), [moonHour]);
    const tracks = useMemo(() => [...paths, moon.ring], [paths, moon]);

    const frame = useMemo<LayerFrame>(() => {
      const markers: GlobeMarker[] = flybys.map((flyby) => ({
        id: flyby.id,
        position: toScene(flybyOffsetKm(flyby, nowMs)),
        color: flyby.asteroid.hazardous ? HAZARD_COLOR : SAFE_COLOR,
        label: `${shortName(flyby.asteroid.name)} · ${relativeTime(flyby.closeApproachMs - nowMs)}`,
      }));
      markers.push(moon.marker);
      return { markers, tracks };
    }, [flybys, nowMs, moon, tracks]);

    const hazardous = flybys.filter((f) => f.asteroid.hazardous).length;
    return {
      frame,
      loading,
      error,
      summary: data
        ? `${flybys.length} closest pass${flybys.length === 1 ? '' : 'es'} within ±${windowDays} d — schematic directions, real distances & timing`
        : null,
      legend: [
        { label: `Safe (${flybys.length - hazardous})`, color: '#9fd8ff' },
        { label: `Potentially hazardous (${hazardous})`, color: '#ff4d4d' },
        { label: 'Moon orbit (scale)', color: '#cfd4e0' },
      ],
      describe(hit) {
        if (hit.kind !== 'marker') {
          return null;
        }
        if (hit.id === MOON_MARKER_ID) {
          return {
            title: 'Moon',
            fields: [{ label: 'Distance', value: `≈${formatDistance(384_400)} (1 lunar distance)` }],
          };
        }
        const flyby = flybys.find((f) => f.id === hit.id);
        if (!flyby) {
          return null;
        }
        const { asteroid } = flyby;
        const offset = flybyOffsetKm(flyby, nowMs);
        const distanceNow = Math.hypot(offset.x, offset.y, offset.z);
        return {
          title: asteroid.name,
          fields: [
            { label: 'Closest approach', value: `${formatTime(flyby.closeApproachMs)} (${relativeTime(flyby.closeApproachMs - nowMs)})` },
            { label: 'Miss distance', value: `${formatDistance(asteroid.missDistanceKm)} · ${lunarDistances(asteroid.missDistanceKm).toFixed(2)} LD` },
            { label: 'Distance now', value: formatDistance(distanceNow) },
            { label: 'Speed', value: formatSpeed(flyby.speedKmS) },
            { label: 'Diameter', value: formatDiameter(asteroid.diameterMinKm, asteroid.diameterMaxKm) },
            { label: 'Hazardous', value: asteroid.hazardous ? 'Yes (PHA)' : 'No' },
            ...(asteroid.orbitClass ? [{ label: 'Orbit class', value: asteroid.orbitClass }] : []),
            ...(asteroid.orbitUncertainty !== undefined && asteroid.orbitUncertainty !== null
              ? [{ label: 'Orbit uncertainty', value: `${asteroid.orbitUncertainty} / 9${asteroid.orbitUncertainty >= 7 ? ' (low accuracy)' : ''}` }]
              : []),
          ],
          detailUrl: asteroid.jplUrl,
        };
      },
    };
  },
};
