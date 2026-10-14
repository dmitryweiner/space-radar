import { useMemo } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchAurora } from '../api/swpc';
import { geodeticToSceneVector } from '../astro/coords';
import { EARTH_RADIUS_UNITS, type AuroraPoint } from '../render/earthScene';
import type { AuroraSample } from '../api/types';
import { isRecord, type LayerDefinition } from './types';

const CACHE_KEY = 'space-radar:aurora-globe';
const TTL_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;
// Aurorae glow ~100 km up; lift the cloud just off the surface so it reads as a
// halo above the globe rather than painted onto it.
const AURORA_ALTITUDE_KM = 120;

function isAuroraSamples(value: unknown): value is AuroraSample[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number' &&
        typeof item.probability === 'number',
    )
  );
}

export const auroraLayer: LayerDefinition = {
  id: 'aurora',
  title: 'Aurora oval',
  color: '#33ff88',
  useLayer() {
    const { data, loading, error } = useApiResource<AuroraSample[]>({
      key: CACHE_KEY,
      ttlMs: TTL_MS,
      pollMs: POLL_MS,
      fetcher: () => fetchAurora(),
      isValue: isAuroraSamples,
    });

    const frame = useMemo(
      () => ({
        auroraPoints: (data ?? []).map<AuroraPoint>((sample) => ({
          position: geodeticToSceneVector(sample.latitude, sample.longitude, AURORA_ALTITUDE_KM, EARTH_RADIUS_UNITS),
          probability: sample.probability,
        })),
      }),
      [data],
    );

    const peak = useMemo(() => (data && data.length > 0 ? Math.max(...data.map((s) => s.probability)) : 0), [data]);
    const empty = Boolean(data) && (data?.length ?? 0) === 0;
    return {
      frame,
      loading,
      error,
      summary: empty ? 'No aurora activity right now.' : null,
      legend: data && data.length > 0 ? [{ label: `OVATION aurora · peak ${Math.round(peak * 100)}%`, color: '#33ff88' }] : [],
      describe(hit) {
        const sample = hit.kind === 'aurora' && data ? data[hit.index] : undefined;
        if (!sample) {
          return null;
        }
        return {
          title: 'Aurora probability',
          fields: [
            { label: 'Probability', value: `${Math.round(sample.probability * 100)}%` },
            { label: 'Location', value: `${sample.latitude.toFixed(1)}°, ${sample.longitude.toFixed(1)}°` },
          ],
        };
      },
    };
  },
};
