import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { activeCometsUrl, famousCometsUrl, fetchComets } from '../api/sbdb';
import type { Comet } from '../api/types';
import { distanceAu, jdToMs, msToJd, orbitPath, orbitPosition, orbitalPeriodDays } from '../astro/kepler';
import { earthPositionAt } from '../astro/planetPositions';
import type { SolarMarker, SolarTrack } from '../render/solarSystemScene';
import { listSetting, numberSetting } from '../settings/values';
import { useClock } from './issLayer';
import { relativeTime } from './neoFlybyLayer';
import { isRecord, type SolarFrame, type SolarLayerDefinition } from './types';
import { formatTime } from '../format/display';

const ACTIVE_COLOR = 0x6fe3ff;
const FAMOUS_COLOR = 0xb9a6ff;
const DEFAULT_GROUPS = ['active', 'famous'];
const DEFAULT_MAX_ACTIVE = 10;
// "Active": perihelion within a year either side of today, inside 4 AU.
const ACTIVE_WINDOW_DAYS = 365;
const ACTIVE_MAX_Q_AU = 4;
const TTL_MS = 12 * 60 * 60 * 1000;
const LIVE_TICK_MS = 60 * 1000;
const OPEN_ARC_AU = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function isComets(value: unknown): value is Comet[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        isRecord(c) &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        ['q', 'e', 'i', 'node', 'peri', 'tpJd'].every((key) => typeof c[key] === 'number'),
    )
  );
}

interface ShownComet {
  comet: Comet;
  famous: boolean;
}

function sbdbLookupUrl(id: string): string {
  return `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(id)}`;
}

export const cometsLayer: SolarLayerDefinition = {
  id: 'comets',
  title: 'Comets',
  color: '#6fe3ff',
  settings: [
    {
      kind: 'multiselect',
      id: 'groups',
      label: 'Show',
      options: [
        { value: 'active', label: 'Near perihelion now (±1 year)' },
        { value: 'famous', label: 'Famous periodic comets' },
      ],
      defaultValue: DEFAULT_GROUPS,
    },
    { kind: 'number', id: 'maxActive', label: 'Comets near perihelion', min: 3, max: 30, defaultValue: DEFAULT_MAX_ACTIVE },
  ],
  useLayer(settings, time) {
    const groups = listSetting(settings, 'groups', DEFAULT_GROUPS);
    const maxActive = numberSetting(settings, 'maxActive', DEFAULT_MAX_ACTIVE);
    // Both lists are fetched regardless of the toggle — hooks run
    // unconditionally, and each is one small request cached for half a day.
    const active = useApiResource<Comet[]>({
      key: `space-radar:comets:active:${maxActive}`,
      ttlMs: TTL_MS,
      pollMs: TTL_MS,
      fetcher: () => fetchComets(activeCometsUrl(new Date(), ACTIVE_WINDOW_DAYS, ACTIVE_MAX_Q_AU, maxActive)),
      isValue: isComets,
    });
    const famous = useApiResource<Comet[]>({
      key: 'space-radar:comets:famous',
      ttlMs: 7 * DAY_MS,
      pollMs: TTL_MS,
      fetcher: () => fetchComets(famousCometsUrl()),
      isValue: isComets,
    });
    const nowMs = useClock(time, LIVE_TICK_MS);

    const shown = useMemo<ShownComet[]>(() => {
      const byId = new Map<string, ShownComet>();
      if (groups.includes('famous')) {
        for (const comet of famous.data ?? []) byId.set(comet.id, { comet, famous: true });
      }
      if (groups.includes('active')) {
        for (const comet of active.data ?? []) if (!byId.has(comet.id)) byId.set(comet.id, { comet, famous: false });
      }
      return [...byId.values()];
    }, [groups, famous.data, active.data]);

    const tracks = useMemo<SolarTrack[]>(
      () =>
        shown.map(({ comet, famous: isFamous }) => {
          // Whole orbit when it closes inside 40 AU (Halley's does); a long or
          // open orbit only near the Sun — 40 AU arcs of a dozen long-period
          // comets would criss-cross the whole view.
          const full = orbitPath(comet, 160, 40);
          const path = full.closed ? full : orbitPath(comet, 160, OPEN_ARC_AU);
          return {
            id: comet.id,
            points: path.points,
            closed: path.closed,
            color: isFamous ? FAMOUS_COLOR : ACTIVE_COLOR,
            opacity: path.closed ? 0.3 : 0.2,
          };
        }),
      [shown],
    );

    const frame = useMemo<SolarFrame>(() => {
      const jd = msToJd(nowMs);
      const markers: SolarMarker[] = shown.map(({ comet, famous: isFamous }) => ({
        id: comet.id,
        position: orbitPosition(comet, jd),
        color: isFamous ? FAMOUS_COLOR : ACTIVE_COLOR,
        label: comet.name,
      }));
      return { markers, tracks };
    }, [shown, tracks, nowMs]);

    const famousCount = shown.filter((s) => s.famous).length;
    const anyData = active.data !== null || famous.data !== null;
    return {
      frame,
      loading: active.loading && famous.loading,
      error: !anyData ? (active.error ?? famous.error) : null,
      summary: anyData ? `${shown.length} comets (JPL SBDB) · names show up close — click one for details` : null,
      legend: [
        { label: `Near perihelion (${shown.length - famousCount})`, color: '#6fe3ff' },
        { label: `Famous periodic (${famousCount})`, color: '#b9a6ff' },
      ],
      describe(hit) {
        if (hit.kind !== 'marker') return null;
        const comet = shown.find((s) => s.comet.id === hit.id)?.comet;
        if (!comet) return null;
        const at = new Date(nowMs);
        const position = orbitPosition(comet, msToJd(nowMs));
        const fromSun = Math.hypot(position.xAu, position.yAu, position.zAu);
        const fromEarth = distanceAu(position, earthPositionAt(at));
        const perihelionMs = jdToMs(comet.tpJd);
        const period = orbitalPeriodDays(comet);
        return {
          title: comet.name,
          fields: [
            { label: 'Perihelion', value: `${formatTime(perihelionMs)} (${relativeTime(perihelionMs - nowMs)}) at ${comet.q.toFixed(2)} AU` },
            { label: 'From the Sun', value: `${fromSun.toFixed(2)} AU` },
            { label: 'From Earth', value: `${fromEarth.toFixed(2)} AU` },
            { label: 'Eccentricity', value: comet.e.toFixed(4) },
            {
              label: 'Period',
              value: period !== null ? `${(period / 365.25).toFixed(period > 365.25 * 200 ? 0 : 1)} years` : 'Open orbit — not coming back',
            },
            { label: 'Inclination', value: `${comet.i.toFixed(1)}°${comet.i > 90 ? ' (retrograde)' : ''}` },
            ...(comet.magnitude !== null ? [{ label: 'Absolute magnitude M1', value: comet.magnitude.toFixed(1) }] : []),
          ],
          detailUrl: sbdbLookupUrl(comet.id),
        };
      },
    };
  },
};
