import { useMemo } from 'react';
import { useFlybys } from '../hooks/sharedResources';
import { distanceAu, fromMeanAnomaly, msToJd, orbitPath, orbitPosition, orbitalPeriodDays, type OrbitalElements } from '../astro/kepler';
import { lunarDistances } from '../astro/flyby';
import { earthPositionAt } from '../astro/planetPositions';
import type { SolarMarker, SolarTrack } from '../render/solarSystemScene';
import { formatUtcTimestamp } from '../cards/formatTimestamp';
import { numberSetting } from '../settings/values';
import { useClock } from './issLayer';
import { closestFlybys, relativeTime, shortName, type Flyby } from './neoFlybyLayer';
import type { SolarFrame, SolarLayerDefinition } from './types';

// The same NeoWs close approaches as the Earth "Asteroid flybys" layer (shared
// request), but on their real heliocentric orbits from the JPL elements NeoWs
// returns with detailed=true — "level B" of the flyby plan.

const SAFE_COLOR = 0x9fd8ff;
const HAZARD_COLOR = 0xff4d4d;
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MAX_OBJECTS = 15;
const LIVE_TICK_MS = 60 * 1000;

interface OrbitingFlyby extends Flyby {
  elements: OrbitalElements;
}

export const solarAsteroidsLayer: SolarLayerDefinition = {
  id: 'sol-asteroids',
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

    const flybys = useMemo<OrbitingFlyby[]>(
      () =>
        closestFlybys(data ?? [], maxObjects).flatMap((flyby) =>
          flyby.asteroid.elements ? [{ ...flyby, elements: fromMeanAnomaly(flyby.asteroid.elements) }] : [],
        ),
      [data, maxObjects],
    );

    const tracks = useMemo<SolarTrack[]>(
      () =>
        flybys.map((flyby) => {
          const path = orbitPath(flyby.elements, 128);
          return {
            id: flyby.id,
            points: path.points,
            closed: path.closed,
            color: flyby.asteroid.hazardous ? HAZARD_COLOR : SAFE_COLOR,
            opacity: 0.35,
          };
        }),
      [flybys],
    );

    const frame = useMemo<SolarFrame>(() => {
      const jd = msToJd(nowMs);
      const markers: SolarMarker[] = flybys.map((flyby) => ({
        id: flyby.id,
        position: orbitPosition(flyby.elements, jd),
        color: flyby.asteroid.hazardous ? HAZARD_COLOR : SAFE_COLOR,
        label: shortName(flyby.asteroid.name),
      }));
      return { markers, tracks };
    }, [flybys, tracks, nowMs]);

    const hazardous = flybys.filter((f) => f.asteroid.hazardous).length;
    return {
      frame,
      loading,
      error,
      summary: data
        ? `${flybys.length} closest Earth flybys within ±${windowDays} d on their real orbits — names show up close (fly to Earth). Planets are drawn hundreds of times too big, so a very close pass can sit inside Earth's ball.`
        : null,
      legend: [
        { label: `Safe (${flybys.length - hazardous})`, color: '#9fd8ff' },
        { label: `Potentially hazardous (${hazardous})`, color: '#ff4d4d' },
      ],
      describe(hit) {
        if (hit.kind !== 'marker') return null;
        const flyby = flybys.find((f) => f.id === hit.id);
        if (!flyby) return null;
        const { asteroid, elements } = flyby;
        const position = orbitPosition(elements, msToJd(nowMs));
        const fromSun = Math.hypot(position.xAu, position.yAu, position.zAu);
        const fromEarth = distanceAu(position, earthPositionAt(new Date(nowMs)));
        const period = orbitalPeriodDays(elements);
        const a = asteroid.elements?.a;
        return {
          title: asteroid.name,
          fields: [
            { label: 'Closest approach', value: `${formatUtcTimestamp(new Date(flyby.closeApproachMs).toISOString())} (${relativeTime(flyby.closeApproachMs - nowMs)})` },
            { label: 'Miss distance', value: `${Math.round(asteroid.missDistanceKm).toLocaleString()} km · ${lunarDistances(asteroid.missDistanceKm).toFixed(2)} LD` },
            { label: 'From Earth now', value: `${fromEarth.toFixed(4)} AU` },
            { label: 'From the Sun', value: `${fromSun.toFixed(3)} AU` },
            {
              label: 'Orbit',
              value: `${a !== undefined ? `a ${a.toFixed(2)} AU · ` : ''}e ${elements.e.toFixed(2)} · i ${elements.i.toFixed(1)}°${period !== null ? ` · ${(period / 365.25).toFixed(2)} yr` : ''}`,
            },
            { label: 'Diameter', value: `${asteroid.diameterMinKm.toFixed(2)}–${asteroid.diameterMaxKm.toFixed(2)} km` },
            { label: 'Hazardous', value: asteroid.hazardous ? 'Yes (PHA)' : 'No' },
            ...(asteroid.orbitClass ? [{ label: 'Orbit class', value: asteroid.orbitClass }] : []),
          ],
          detailUrl: asteroid.jplUrl,
        };
      },
    };
  },
};
