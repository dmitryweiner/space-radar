import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchAurora } from '../../api/swpc';
import { geodeticToSceneVector } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type AuroraPoint, type EarthSceneHandle } from '../../render/earthScene';
import type { AuroraSample } from '../../api/types';

const CACHE_KEY = 'space-radar:aurora-globe';
const TTL_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;
// Aurorae glow ~100 km up; lift the cloud just off the surface so it reads as a
// halo above the globe rather than painted onto it.
const AURORA_ALTITUDE_KM = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

export function AuroraGlobeCard() {
  const { data, loading, error } = useApiResource<AuroraSample[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchAurora(),
    isValue: isAuroraSamples,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<EarthSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      const scene = createEarthScene(canvas);
      sceneRef.current = scene;
      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    } catch {
      queueMicrotask(() => setSceneError('3D rendering is not available in this browser.'));
      return undefined;
    }
  }, []);

  const points = useMemo<AuroraPoint[]>(
    () =>
      (data ?? []).map((sample) => ({
        position: geodeticToSceneVector(sample.latitude, sample.longitude, AURORA_ALTITUDE_KM, EARTH_RADIUS_UNITS),
        probability: sample.probability,
      })),
    [data],
  );

  useEffect(() => {
    sceneRef.current?.setAuroraPoints(points);
  }, [points]);

  const peak = useMemo(
    () => (data && data.length > 0 ? Math.max(...data.map((sample) => sample.probability)) : 0),
    [data],
  );

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && points.length === 0 && (
        <p className="card-status globe-overlay">No aurora activity right now.</p>
      )}
      {!sceneError && !loading && !error && points.length > 0 && (
        <div className="globe-legend">
          <span className="globe-legend-item">
            <span className="globe-legend-swatch" style={{ backgroundColor: '#33ff88' }} />
            OVATION aurora · peak {Math.round(peak * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
