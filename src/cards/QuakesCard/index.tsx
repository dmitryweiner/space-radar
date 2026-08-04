import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchQuakes, QUAKE_FEEDS } from '../../api/usgsQuakes';
import { geodeticToSceneVector } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type EarthSceneHandle, type GlobeMarker } from '../../render/earthScene';
import type { Quake } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { listSetting, numberSetting } from '../../layout/layoutState';
import { ZoomButtons } from '../ZoomButtons';

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

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export function QuakesCard({ settings = {} }: CardComponentProps) {
  const feeds = listSetting(settings, 'feeds', DEFAULT_FEEDS);
  const maxQuakes = numberSetting(settings, 'maxQuakes', DEFAULT_MAX_QUAKES);
  // Cache/poll per feed combination — each URL set is a distinct resource.
  const cacheKey = `space-radar:quakes:${[...feeds].sort().join(',')}`;

  const { data, loading, error } = useApiResource<Quake[]>({
    key: cacheKey,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchQuakes(feeds),
    isValue: isQuakes,
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

  // Strongest quakes first so the cap keeps the most significant events.
  const quakes = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.magnitude - a.magnitude).slice(0, maxQuakes),
    [data, maxQuakes],
  );

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const markers: GlobeMarker[] = quakes.map((quake) => ({
      id: quake.id,
      position: geodeticToSceneVector(quake.latitude, quake.longitude, 0, EARTH_RADIUS_UNITS),
      color: bandOf(quake.magnitude).hex,
      label: quake.magnitude >= LABEL_MIN_MAGNITUDE ? `M${quake.magnitude.toFixed(1)}` : undefined,
    }));
    scene.setMarkers(markers);
  }, [quakes]);

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quake of quakes) {
      const band = bandOf(quake.magnitude);
      counts.set(band.label, (counts.get(band.label) ?? 0) + 1);
    }
    return BANDS.map((entry) => entry.band).filter((band) => counts.has(band.label))
      .map((band) => ({ band, count: counts.get(band.label) ?? 0 }));
  }, [quakes]);

  const feedLabel = QUAKE_FEEDS.filter((feed) => feeds.includes(feed.value)).map((feed) => feed.label).join(' · ');

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {!sceneError && (
        <ZoomButtons onZoomIn={() => sceneRef.current?.zoom('in')} onZoomOut={() => sceneRef.current?.zoom('out')} />
      )}
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && quakes.length === 0 && (
        <p className="card-status globe-overlay">No earthquakes in {feedLabel || 'the selected feeds'}.</p>
      )}
      {!sceneError && !loading && !error && legend.length > 0 && (
        <div className="globe-legend">
          {legend.map(({ band, count }) => (
            <span key={band.label} className="globe-legend-item">
              <span className="globe-legend-swatch" style={{ backgroundColor: hexToCss(band.hex) }} />
              {band.label} ({count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
