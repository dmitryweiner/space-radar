import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchFireballs } from '../api/jplFireballs';
import type { Fireball } from '../api/types';
import { geodeticToSceneVector } from '../astro/coords';
import { EARTH_RADIUS_UNITS, type GlobeMarker } from '../render/earthScene';
import { numberSetting } from '../layout/layoutState';
import { hexToCss, isRecord, type LayerDefinition } from './types';

const TTL_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MONTHS = 12;
// Only the bigger events get a permanent label.
const LABEL_MIN_KT = 0.3;

const BANDS = [
  { min: 1, label: '≥1 kt', hex: 0xff3b3b },
  { min: 0.1, label: '0.1–1 kt', hex: 0xff9d2b },
  { min: 0, label: '<0.1 kt', hex: 0xffe066 },
];

function bandOf(kt: number) {
  return BANDS.find((band) => kt >= band.min) ?? BANDS[BANDS.length - 1];
}

function isFireballs(value: unknown): value is Fireball[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => isRecord(item) && typeof item.date === 'string' && typeof item.latitude === 'number' && typeof item.longitude === 'number',
    )
  );
}

function monthsAgo(months: number): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export const fireballsLayer: LayerDefinition = {
  id: 'fireballs',
  title: 'Fireballs (bolides)',
  color: '#ff9d2b',
  settings: [{ kind: 'number', id: 'months', label: 'Months back', min: 1, max: 60, defaultValue: DEFAULT_MONTHS }],
  useLayer(settings) {
    const months = numberSetting(settings, 'months', DEFAULT_MONTHS);
    const { data, loading, error } = useApiResource<Fireball[]>({
      key: `space-radar:fireballs:${months}`,
      ttlMs: TTL_MS,
      pollMs: POLL_MS,
      fetcher: () => fetchFireballs(monthsAgo(months)),
      isValue: isFireballs,
    });

    const fireballs = useMemo(() => data ?? [], [data]);
    const frame = useMemo(() => {
      const markers: GlobeMarker[] = fireballs.map((f, index) => ({
        id: `fireball-${index}`,
        position: geodeticToSceneVector(f.latitude, f.longitude, 0, EARTH_RADIUS_UNITS),
        color: bandOf(f.impactEnergyKt).hex,
        label: f.impactEnergyKt >= LABEL_MIN_KT ? `${f.impactEnergyKt} kt` : undefined,
      }));
      return { markers };
    }, [fireballs]);

    return {
      frame,
      loading,
      error,
      summary: data ? `${fireballs.length} located fireball${fireballs.length === 1 ? '' : 's'} in ${months} months (JPL)` : null,
      legend: BANDS.map((band) => ({ label: band.label, color: hexToCss(band.hex) })),
      describe(hit) {
        const match = hit.kind === 'marker' ? /^fireball-(\d+)$/.exec(hit.id) : null;
        const fireball = match ? fireballs[Number(match[1])] : undefined;
        if (!fireball) {
          return null;
        }
        return {
          title: `Fireball ${fireball.date} UTC`,
          fields: [
            { label: 'Impact energy', value: `${fireball.impactEnergyKt} kt TNT` },
            { label: 'Location', value: `${fireball.latitude.toFixed(1)}°, ${fireball.longitude.toFixed(1)}°` },
            ...(fireball.altitudeKm !== null ? [{ label: 'Altitude', value: `${fireball.altitudeKm} km` }] : []),
            ...(fireball.velocityKmS !== null ? [{ label: 'Velocity', value: `${fireball.velocityKmS} km/s` }] : []),
          ],
          detailUrl: 'https://cneos.jpl.nasa.gov/fireballs/',
        };
      },
    };
  },
};
