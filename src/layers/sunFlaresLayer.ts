import { useMemo } from 'react';
import { useSolarFlareEvents, useSolarRegions } from '../hooks/sharedResources';
import { parseSolarLocation, rotateToTime, type HeliographicPoint } from '../astro/sunDisk';
import type { SolarFlare, SolarRegion } from '../api/types';
import { numberSetting, selectSetting } from '../settings/values';
import { formatTime } from '../format/display';
import { useClock } from './issLayer';
import { regionPositionAt } from './sunRegionsLayer';
import type { SunLayerDefinition, SunMarker } from './types';

const ROTATE_TICK_MS = 10 * 60 * 1000;
const DEFAULT_HOURS = 24;
const CLASS_ORDER = 'ABCMX';

interface ClassStyle {
  letter: string;
  label: string;
  color: string;
  sizePx: number;
}

// Same colours as the flare list's badges (SolarFlaresCard).
const CLASS_STYLES: ClassStyle[] = [
  { letter: 'X', label: 'X-class', color: '#d03b3b', sizePx: 18 },
  { letter: 'M', label: 'M-class', color: '#ec835a', sizePx: 15 },
  { letter: 'C', label: 'C-class', color: '#fab219', sizePx: 12 },
  { letter: 'B', label: 'B-class', color: '#0ca30c', sizePx: 10 },
];

function styleOf(classType: string): ClassStyle {
  return CLASS_STYLES.find((style) => style.letter === classType.charAt(0)) ?? CLASS_STYLES[CLASS_STYLES.length - 1];
}

/** Total order on GOES classes: letter first, then the number ("M1.2" < "M3"). */
export function flareStrength(classType: string): number {
  const letter = CLASS_ORDER.indexOf(classType.charAt(0));
  const value = Number.parseFloat(classType.slice(1));
  return letter * 100 + (Number.isFinite(value) ? value : 0);
}

export interface FlareGroup {
  key: string;
  region: number | null;
  /** Position now (rotated from the observation). */
  position: HeliographicPoint;
  /** Strongest first. */
  flares: SolarFlare[];
}

/**
 * Flares of the window grouped by where they happened: an optical location
 * when one was reported, else their region's position. Flares with neither
 * (a region not in today's report — usually already round the limb) are
 * counted but not placed.
 */
export function groupFlares(flares: SolarFlare[], regions: SolarRegion[], nowMs: number): { groups: FlareGroup[]; unplaced: number } {
  const regionById = new Map(regions.map((region) => [region.region, region]));
  const groups = new Map<string, FlareGroup>();
  let unplaced = 0;
  for (const flare of flares) {
    const optical = flare.location ? parseSolarLocation(flare.location) : null;
    const region = flare.region !== null ? regionById.get(flare.region) : undefined;
    let position: HeliographicPoint | null = null;
    if (region) {
      position = regionPositionAt(region, nowMs);
    } else if (optical) {
      position = rotateToTime(optical, Date.parse(flare.peak ?? flare.begin), nowMs);
    }
    if (!position) {
      unplaced += 1;
      continue;
    }
    const key = flare.region !== null ? `r${flare.region}` : `l${flare.location}`;
    const group = groups.get(key);
    if (group) {
      group.flares.push(flare);
    } else {
      groups.set(key, { key, region: flare.region, position, flares: [flare] });
    }
  }
  for (const group of groups.values()) {
    group.flares.sort((a, b) => flareStrength(b.classType) - flareStrength(a.classType));
  }
  return { groups: [...groups.values()], unplaced };
}

export const sunFlaresLayer: SunLayerDefinition = {
  id: 'sun-flares',
  title: 'Recent flares',
  color: '#fab219',
  settings: [
    { kind: 'number', id: 'hours', label: 'Last … hours', min: 6, max: 168, step: 6, defaultValue: DEFAULT_HOURS },
    {
      kind: 'select',
      id: 'minClass',
      label: 'Weakest class shown',
      options: [
        { value: 'B', label: 'B and up' },
        { value: 'C', label: 'C and up' },
        { value: 'M', label: 'M and up' },
      ],
      defaultValue: 'C',
    },
  ],
  useLayer(settings) {
    const hours = numberSetting(settings, 'hours', DEFAULT_HOURS);
    const minClass = selectSetting(settings, 'minClass', 'C');
    const flareEvents = useSolarFlareEvents();
    const regionReport = useSolarRegions();
    const now = useClock(null, ROTATE_TICK_MS);

    const { groups, unplaced, total } = useMemo(() => {
      const since = now - hours * 3_600_000;
      const minStrength = flareStrength(minClass);
      const recent = (flareEvents.data ?? []).filter(
        (flare) => Date.parse(flare.begin) >= since && flareStrength(flare.classType) >= minStrength,
      );
      return { ...groupFlares(recent, regionReport.data ?? [], now), total: recent.length };
    }, [flareEvents.data, regionReport.data, hours, minClass, now]);

    const frame = useMemo(() => {
      const markers: SunMarker[] = groups.map((group) => {
        const strongest = group.flares[0];
        const style = styleOf(strongest.classType);
        const more = group.flares.length - 1;
        return {
          id: group.key,
          ...group.position,
          color: style.color,
          shape: 'star',
          sizePx: style.sizePx,
          label: more > 0 ? `${strongest.classType} +${more}` : strongest.classType,
          labelSide: 'left',
        };
      });
      return { markers };
    }, [groups]);

    const summary = flareEvents.data
      ? total === 0
        ? `No ${minClass}-class or stronger flares in the last ${hours} h.`
        : `${total} flare${total === 1 ? '' : 's'} in ${hours} h${unplaced > 0 ? ` (${unplaced} without a position)` : ''}`
      : null;

    return {
      frame,
      loading: flareEvents.loading,
      error: flareEvents.error,
      summary,
      legend: CLASS_STYLES.filter((style) => flareStrength(style.letter) >= flareStrength(minClass)).map(({ label, color }) => ({ label, color })),
      describe(hit) {
        if (hit.kind !== 'marker') return null;
        const group = groups.find((g) => g.key === hit.id);
        if (!group) return null;
        return {
          title: group.region !== null ? `Flares from region ${group.region}` : `Flares at ${group.flares[0].location ?? '?'}`,
          // Labelled by time: the inspector keys fields by label, and classes repeat.
          fields: group.flares.map((flare) => ({
            label: formatTime(flare.peak ?? flare.begin),
            value: `${flare.classType}${flare.location ? ` · ${flare.location}` : ''}`,
          })),
          detailUrl: 'https://www.swpc.noaa.gov/products/goes-x-ray-flux',
        };
      },
    };
  },
};
