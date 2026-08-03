import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchFirePoints } from '../../api/firms';
import { geodeticToSceneVector } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type EarthSceneHandle, type FirePoint as SceneFirePoint } from '../../render/earthScene';
import type { FirePoint } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';

const CACHE_KEY = 'space-radar:fire-points';
// FIRMS updates a few times a day and the world CSV is large — poll slowly.
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;
const DEFAULT_DAY_RANGE = 1;
const DEFAULT_LABEL_COUNT = 30;
// Normalize brightness temperature (Kelvin) to a 0..1 colour ramp.
const BRIGHT_MIN = 300;
const BRIGHT_MAX = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

// Label text drawn beside the strongest fire points. acquiredAt is
// "YYYY-MM-DD HHMM" (UTC); pretty-print the HHMM time and append brightness +
// confidence when present.
function fireInfo(point: FirePoint): string {
  const [date, rawTime] = point.acquiredAt.split(' ');
  const digits = (rawTime ?? '').padStart(4, '0');
  const when = rawTime ? `${date} ${digits.slice(0, 2)}:${digits.slice(2)} UTC` : date;
  const parts = [when];
  if (Number.isFinite(point.brightnessKelvin) && point.brightnessKelvin > 0) {
    parts.push(`${Math.round(point.brightnessKelvin)} K`);
  }
  if (point.confidence !== null) {
    parts.push(`${Math.round(point.confidence * 100)}% conf`);
  }
  return parts.join(' · ');
}

export function FireMapCard({ settings = {} }: CardComponentProps) {
  const dayRange = numberSetting(settings, 'dayRange', DEFAULT_DAY_RANGE);
  const labelCount = numberSetting(settings, 'labelCount', DEFAULT_LABEL_COUNT);
  const { data, loading, error } = useApiResource<FirePoint[]>({
    key: `${CACHE_KEY}:${dayRange}`,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchFirePoints(undefined, { dayRange }),
    isValue: isFirePoints,
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

  const scenePoints = useMemo<SceneFirePoint[]>(() => {
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
    return points.map((point, index) => ({
      position: geodeticToSceneVector(point.latitude, point.longitude, 0, EARTH_RADIUS_UNITS),
      intensity: intensity(point),
      label: labelled.has(index) ? fireInfo(point) : undefined,
    }));
  }, [data, labelCount]);

  useEffect(() => {
    sceneRef.current?.setFirePoints(scenePoints);
  }, [scenePoints]);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && data && (
        <p className="card-status globe-overlay">
          {data.length.toLocaleString()} active fire{data.length === 1 ? '' : 's'} · last {dayRange}d (VIIRS)
          {data.length > 0 && labelCount > 0 && ` · top ${Math.min(labelCount, data.length)} labelled`}
        </p>
      )}
    </div>
  );
}
