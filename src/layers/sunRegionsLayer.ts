import { useMemo } from 'react';
import { useSolarRegions } from '../hooks/sharedResources';
import { formatSolarLocation, rotateToTime } from '../astro/sunDisk';
import type { SolarRegion } from '../api/types';
import { selectSetting } from '../settings/values';
import { useClock } from './issLayer';
import type { LegendItem, SunLayerDefinition, SunMarker } from './types';

// Positions drift ~0.55°/h with solar rotation; re-place every 10 min.
const ROTATE_TICK_MS = 10 * 60 * 1000;

interface ChanceBand {
  min: number;
  label: string;
  color: string;
}

// Coloured by SWPC's 24 h M-class flare probability: "how likely is this one
// to do something" is what the region view is for.
const CHANCE_BANDS: ChanceBand[] = [
  { min: 50, label: 'M-flare chance ≥ 50%', color: '#d03b3b' },
  { min: 20, label: 'M-flare chance 20–50%', color: '#ec835a' },
  { min: 5, label: 'M-flare chance 5–20%', color: '#fab219' },
  { min: 0, label: 'M-flare chance < 5%', color: '#5eb1ff' },
];
const PLAGE: LegendItem = { label: 'No spots (plage)', color: '#8a94b8' };

function bandOf(region: SolarRegion): ChanceBand {
  const chance = region.probability?.m ?? 0;
  return CHANCE_BANDS.find((band) => chance >= band.min) ?? CHANCE_BANDS[CHANCE_BANDS.length - 1];
}

const DAY_MS = 86_400_000;

/**
 * When the report's positions are for: 00:00 UTC of the day *after*
 * `observed_date`. Calibrated, not documented: carrying the optical flare
 * locations in SWPC's event list (296 of them, Oct 2026) to 00:00 of the
 * observed date put their regions 13.6° (one day of rotation) east of the
 * reported position, and the HMI image's sunspots agreed.
 */
export function regionEpochMs(region: SolarRegion): number {
  return Date.parse(`${region.observedDate}T00:00:00Z`) + DAY_MS;
}

/** A region's Stonyhurst position carried forward to `atMs`. */
export function regionPositionAt(region: SolarRegion, atMs: number) {
  return rotateToTime({ latDeg: region.latDeg, lonDeg: region.lonDeg }, regionEpochMs(region), atMs);
}

function hasSpots(region: SolarRegion): boolean {
  return region.area !== null && region.area > 0;
}

export const sunRegionsLayer: SunLayerDefinition = {
  id: 'sun-regions',
  title: 'Active regions',
  color: '#ec835a',
  settings: [
    {
      kind: 'select',
      id: 'show',
      label: 'Show',
      options: [
        { value: 'spots', label: 'Regions with sunspots' },
        { value: 'all', label: 'Also plage-only regions' },
      ],
      defaultValue: 'spots',
    },
  ],
  useLayer(settings) {
    const showAll = selectSetting(settings, 'show', 'spots') === 'all';
    const { data, loading, error } = useSolarRegions();
    const now = useClock(null, ROTATE_TICK_MS);

    const regions = useMemo(() => (data ?? []).filter((region) => showAll || hasSpots(region)), [data, showAll]);

    const frame = useMemo(() => {
      const markers: SunMarker[] = regions.map((region) => {
        const spotted = hasSpots(region);
        return {
          id: String(region.region),
          ...regionPositionAt(region, now),
          color: spotted ? bandOf(region).color : PLAGE.color,
          shape: 'ring',
          // Bigger rings for bigger spot groups (area 10 → ~8 px, 1000 → ~25 px).
          sizePx: spotted ? 6 + Math.sqrt(region.area ?? 0) * 0.6 : 5,
          label: String(region.region),
        };
      });
      return { markers };
    }, [regions, now]);

    const spotted = regions.filter(hasSpots).length;
    const summary = data
      ? regions.length === 0
        ? 'No numbered regions on the disk.'
        : `${spotted} sunspot region${spotted === 1 ? '' : 's'} · report of ${data[0]?.observedDate ?? '—'}`
      : null;

    return {
      frame,
      loading,
      error,
      summary,
      legend: [...CHANCE_BANDS.map(({ label, color }) => ({ label, color })), ...(showAll ? [PLAGE] : [])],
      describe(hit) {
        if (hit.kind !== 'marker') return null;
        const region = regions.find((r) => String(r.region) === hit.id);
        if (!region) return null;
        const probability = region.probability;
        const fields = [
          { label: 'Position now', value: formatSolarLocation(regionPositionAt(region, Date.now())) },
          { label: 'Sunspots', value: hasSpots(region) ? `${region.spots ?? '?'} · ${region.area} MSH` : 'none (plage)' },
          ...(region.spotClass ? [{ label: 'McIntosh class', value: region.spotClass }] : []),
          ...(region.magClass ? [{ label: 'Magnetic class', value: region.magClass }] : []),
          ...(probability ? [{ label: 'Flare chance (24 h)', value: `C ${probability.c}% · M ${probability.m}% · X ${probability.x}%` }] : []),
          { label: 'Flares that day', value: `C ${region.flares.c} · M ${region.flares.m} · X ${region.flares.x}` },
          { label: 'SWPC report', value: region.observedDate },
        ];
        return { title: `Region ${region.region}`, fields, detailUrl: 'https://www.swpc.noaa.gov/products/solar-region-summary' };
      },
    };
  },
};
