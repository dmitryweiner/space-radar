import { useEffect, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchTleGroup } from '../../api/celestrak';
import { computeSatellitePosition } from '../../astro/satellitePosition';
import { geodeticToSceneVector, type SceneVector3 } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type EarthSceneHandle } from '../../render/earthScene';
import type { TleRecord } from '../../api/types';

const CACHE_KEY = 'space-radar:tle-stations';
const TTL_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 6 * 60 * 60 * 1000;
const POSITION_UPDATE_MS = 1000;
const ORBIT_SAMPLE_COUNT = 120;
const ORBIT_SAMPLE_SPAN_MS = 100 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTleRecords(value: unknown): value is TleRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        typeof item.line1 === 'string' &&
        typeof item.line2 === 'string',
    )
  );
}

function findIss(records: TleRecord[]): TleRecord | null {
  return records.find((record) => /zarya|\biss\b/i.test(record.name)) ?? null;
}

function sampleOrbit(tle: TleRecord, now: number): SceneVector3[] {
  const points: SceneVector3[] = [];
  for (let i = 0; i <= ORBIT_SAMPLE_COUNT; i += 1) {
    const t = new Date(now + (i / ORBIT_SAMPLE_COUNT) * ORBIT_SAMPLE_SPAN_MS);
    const position = computeSatellitePosition(tle, t);
    if (position) {
      points.push(geodeticToSceneVector(position.latitudeDeg, position.longitudeDeg, position.altitudeKm, EARTH_RADIUS_UNITS));
    }
  }
  return points;
}

export function IssGlobeCard() {
  const { data, loading, error } = useApiResource<TleRecord[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchTleGroup('stations'),
    isValue: isTleRecords,
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

  const iss = data ? findIss(data) : null;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!iss || !scene) {
      return;
    }

    scene.setOrbitPath(sampleOrbit(iss, Date.now()));

    function updatePosition() {
      const scene2 = sceneRef.current;
      if (!scene2 || !iss) {
        return;
      }
      const position = computeSatellitePosition(iss, new Date());
      scene2.setIssPosition(
        position ? geodeticToSceneVector(position.latitudeDeg, position.longitudeDeg, position.altitudeKm, EARTH_RADIUS_UNITS) : null,
      );
    }
    updatePosition();
    const interval = setInterval(updatePosition, POSITION_UPDATE_MS);
    return () => clearInterval(interval);
  }, [iss]);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && data && !iss && (
        <p className="card-status globe-overlay">ISS not found in this group.</p>
      )}
    </div>
  );
}
