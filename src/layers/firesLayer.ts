import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchFirePoints } from '../api/firms';
import { geodeticToSceneVector } from '../astro/coords';
import { EARTH_RADIUS_UNITS, type FirePoint as SceneFirePoint } from '../render/earthScene';
import type { FirePoint } from '../api/types';
import { numberSetting } from '../layout/layoutState';
import { isRecord, type LayerDefinition } from './types';

const CACHE_KEY = 'space-radar:fire-points';
// FIRMS updates a few times a day and the world CSV is large — poll slowly.
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;
const DEFAULT_DAY_RANGE = 1;
const DEFAULT_LABEL_COUNT = 30;
// Normalize brightness temperature (Kelvin) to a 0..1 colour ramp.
const BRIGHT_MIN = 300;
const BRIGHT_MAX = 400;

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isFirePoints(value: unknown): value is FirePoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number' &&
        typeof item.brightnessKelvin === 'number' &&
        isNullableNumber(item.confidence) &&
        typeof item.acquiredAt === 'string',
    )
  );
}

function intensity(point: FirePoint): number {
  const fromBrightness = (point.brightnessKelvin - BRIGHT_MIN) / (BRIGHT_MAX - BRIGHT_MIN);
  const base = Number.isFinite(fromBrightness) ? fromBrightness : 0;
  return Math.min(1, Math.max(0, point.confidence ?? base));
}

// acquiredAt is "YYYY-MM-DD HHMM" (UTC); pretty-print the HHMM time.
function formatAcquiredAt(point: FirePoint): string {
  const [date, rawTime] = point.acquiredAt.split(' ');
  const digits = (rawTime ?? '').padStart(4, '0');
  return rawTime ? `${date} ${digits.slice(0, 2)}:${digits.slice(2)} UTC` : date;
}

// Label text drawn beside the strongest fire points: time + brightness.
function fireInfo(point: FirePoint): string {
  const parts = [formatAcquiredAt(point)];
  if (Number.isFinite(point.brightnessKelvin) && point.brightnessKelvin > 0) {
    parts.push(`${Math.round(point.brightnessKelvin)} K`);
  }
  return parts.join(' · ');
}

export const firesLayer: LayerDefinition = {
  id: 'fires',
  title: 'Active fires',
  color: '#ff6a2b',
  settings: [
    { kind: 'number', id: 'dayRange', label: 'Days back', min: 1, max: 7, defaultValue: DEFAULT_DAY_RANGE },
    { kind: 'number', id: 'labelCount', label: 'Labelled fires', min: 0, max: 100, step: 10, defaultValue: DEFAULT_LABEL_COUNT },
  ],
  useLayer(settings) {
    const dayRange = numberSetting(settings, 'dayRange', DEFAULT_DAY_RANGE);
    const labelCount = numberSetting(settings, 'labelCount', DEFAULT_LABEL_COUNT);
    const { data, loading, error } = useApiResource<FirePoint[]>({
      key: `${CACHE_KEY}:${dayRange}`,
      ttlMs: TTL_MS,
      pollMs: POLL_MS,
      fetcher: () => fetchFirePoints(undefined, { dayRange }),
      isValue: isFirePoints,
    });

    const frame = useMemo(() => {
      const points = data ?? [];
      // Label only the strongest fires (by brightness temperature) — labelling
      // all several-thousand points would be an unreadable wall of text.
      const labelled = new Set(
        points
          .map((point, index) => ({ index, brightness: point.brightnessKelvin }))
          .sort((a, b) => b.brightness - a.brightness)
          .slice(0, Math.max(0, labelCount))
          .map((entry) => entry.index),
      );
      const firePoints: SceneFirePoint[] = points.map((point, index) => ({
        position: geodeticToSceneVector(point.latitude, point.longitude, 0, EARTH_RADIUS_UNITS),
        intensity: intensity(point),
        label: labelled.has(index) ? fireInfo(point) : undefined,
      }));
      return { firePoints };
    }, [data, labelCount]);

    const count = data?.length ?? 0;
    return {
      frame,
      loading,
      error,
      summary: data
        ? `${count.toLocaleString()} active fire${count === 1 ? '' : 's'} · last ${dayRange}d (VIIRS)` +
          (count > 0 && labelCount > 0 ? ` · top ${Math.min(labelCount, count)} labelled` : '')
        : null,
      legend: [],
      describe(hit) {
        const fire = hit.kind === 'fire' && data ? data[hit.index] : undefined;
        if (!fire) {
          return null;
        }
        return {
          title: 'Fire detection',
          fields: [
            { label: 'Detected', value: formatAcquiredAt(fire) },
            { label: 'Brightness', value: `${Math.round(fire.brightnessKelvin)} K` },
            { label: 'Confidence', value: fire.confidence === null ? 'Unknown' : `${Math.round(fire.confidence * 100)}%` },
          ],
        };
      },
    };
  },
};
