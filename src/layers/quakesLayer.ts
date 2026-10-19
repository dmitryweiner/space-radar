import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchQuakes, QUAKE_FEEDS } from '../api/usgsQuakes';
import { geodeticToSceneVector } from '../astro/coords';
import { EARTH_RADIUS_UNITS, type GlobeMarker } from '../render/earthScene';
import type { Quake } from '../api/types';
import { listSetting, numberSetting } from '../settings/values';
import { hexToCss, isRecord, type LayerDefinition } from './types';
import { formatDistance, formatTime } from '../format/display';

const TTL_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;
const DEFAULT_FEEDS = ['2.5_day'];
const DEFAULT_MAX_QUAKES = 80;
// Only the stronger shocks get a permanent label; smaller ones would clutter.
const LABEL_MIN_MAGNITUDE = 4.5;

interface MagnitudeBand {
  label: string;
  hex: number;
}

// Ordered strongest-first so the first matching band wins.
const BANDS: { min: number; band: MagnitudeBand }[] = [
  { min: 6, band: { label: 'M6+', hex: 0xd03b3b } },
  { min: 4.5, band: { label: 'M4.5–6', hex: 0xec835a } },
  { min: 3, band: { label: 'M3–4.5', hex: 0xfab219 } },
  { min: 0, band: { label: '<M3', hex: 0x5eb1ff } },
];

function bandOf(magnitude: number): MagnitudeBand {
  return (BANDS.find((entry) => magnitude >= entry.min) ?? BANDS[BANDS.length - 1]).band;
}

function isQuakes(value: unknown): value is Quake[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.magnitude === 'number' &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number',
    )
  );
}

export const quakesLayer: LayerDefinition = {
  id: 'quakes',
  title: 'Earthquakes',
  color: '#ec835a',
  settings: [
    { kind: 'multiselect', id: 'feeds', label: 'Feeds', options: QUAKE_FEEDS, defaultValue: DEFAULT_FEEDS },
    { kind: 'number', id: 'maxQuakes', label: 'Max quakes', min: 20, max: 200, step: 20, defaultValue: DEFAULT_MAX_QUAKES },
  ],
  useLayer(settings) {
    const feeds = listSetting(settings, 'feeds', DEFAULT_FEEDS);
    const maxQuakes = numberSetting(settings, 'maxQuakes', DEFAULT_MAX_QUAKES);
    const feedKey = [...feeds].sort().join(',');
    // Cache/poll per feed combination — each URL set is a distinct resource.
    const { data, loading, error } = useApiResource<Quake[]>({
      key: `space-radar:quakes:${feedKey}`,
      ttlMs: TTL_MS,
      pollMs: POLL_MS,
      fetcher: () => fetchQuakes(feedKey.split(',').filter(Boolean)),
      isValue: isQuakes,
    });

    // Strongest quakes first so the cap keeps the most significant events.
    const quakes = useMemo(
      () => [...(data ?? [])].sort((a, b) => b.magnitude - a.magnitude).slice(0, maxQuakes),
      [data, maxQuakes],
    );

    const frame = useMemo(() => {
      const markers: GlobeMarker[] = quakes.map((quake) => ({
        id: quake.id,
        position: geodeticToSceneVector(quake.latitude, quake.longitude, 0, EARTH_RADIUS_UNITS),
        color: bandOf(quake.magnitude).hex,
        label: quake.magnitude >= LABEL_MIN_MAGNITUDE ? `M${quake.magnitude.toFixed(1)}` : undefined,
      }));
      return { markers };
    }, [quakes]);

    const legend = useMemo(() => {
      const counts = new Map<string, number>();
      for (const quake of quakes) {
        const band = bandOf(quake.magnitude);
        counts.set(band.label, (counts.get(band.label) ?? 0) + 1);
      }
      return BANDS.map((entry) => entry.band)
        .filter((band) => counts.has(band.label))
        .map((band) => ({ label: `${band.label} (${counts.get(band.label) ?? 0})`, color: hexToCss(band.hex) }));
    }, [quakes]);

    const feedLabel = QUAKE_FEEDS.filter((feed) => feeds.includes(feed.value))
      .map((feed) => feed.label)
      .join(' · ');
    return {
      frame,
      loading,
      error,
      summary: data && quakes.length === 0 ? `No earthquakes in ${feedLabel || 'the selected feeds'}.` : null,
      legend,
      describe(hit) {
        const quake = hit.kind === 'marker' ? quakes.find((q) => q.id === hit.id) : undefined;
        if (!quake) {
          return null;
        }
        return {
          title: `M${quake.magnitude.toFixed(1)} — ${quake.place}`,
          fields: [
            { label: 'Time', value: formatTime(quake.time) },
            { label: 'Depth', value: formatDistance(quake.depthKm, 1) },
          ],
          detailUrl: quake.url || null,
        };
      },
    };
  },
};
