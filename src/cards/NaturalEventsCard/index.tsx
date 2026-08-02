import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchNaturalEvents } from '../../api/eonet';
import { geodeticToSceneVector } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type EarthSceneHandle, type GlobeMarker } from '../../render/earthScene';
import type { NaturalEvent } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';

const CACHE_KEY = 'space-radar:natural-events';
const TTL_MS = 30 * 60 * 1000;
const POLL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_EVENTS = 25;

const CATEGORY_COLORS: Record<string, number> = {
  Wildfires: 0xd03b3b,
  Volcanoes: 0xec835a,
  'Severe Storms': 0x3987e5,
  'Sea and Lake Ice': 0x199e70,
  Floods: 0x5eb1ff,
  Earthquakes: 0xb98cff,
  Drought: 0xfab219,
  'Dust and Haze': 0xd9b38c,
  Landslides: 0x9c9c9c,
};

function categoryHex(category: string): number {
  return CATEGORY_COLORS[category] ?? 0xfab219;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function shortTitle(title: string): string {
  return title.length > 22 ? `${title.slice(0, 21)}…` : title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isNaturalEvents(value: unknown): value is NaturalEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.category === 'string' &&
        isNullableString(item.time) &&
        isNullableString(item.magnitude) &&
        isNullableNumber(item.latitude) &&
        isNullableNumber(item.longitude),
    )
  );
}

interface LocatedEvent extends NaturalEvent {
  latitude: number;
  longitude: number;
}

function hasLocation(event: NaturalEvent): event is LocatedEvent {
  return event.latitude !== null && event.longitude !== null;
}

// Round-robin across categories so globally-distributed events (volcanoes,
// storms, sea ice) get shown alongside the far more numerous US wildfires,
// instead of the newest-first list being all wildfires.
function pickDiverse(events: LocatedEvent[], max: number): LocatedEvent[] {
  const byCategory = new Map<string, LocatedEvent[]>();
  for (const event of events) {
    const bucket = byCategory.get(event.category);
    if (bucket) {
      bucket.push(event);
    } else {
      byCategory.set(event.category, [event]);
    }
  }
  const buckets = [...byCategory.values()];
  const picked: LocatedEvent[] = [];
  for (let round = 0; picked.length < max && buckets.some((bucket) => bucket.length > round); round += 1) {
    for (const bucket of buckets) {
      if (picked.length >= max) {
        break;
      }
      if (round < bucket.length) {
        picked.push(bucket[round]);
      }
    }
  }
  return picked;
}

export function NaturalEventsCard({ settings = {} }: CardComponentProps) {
  const maxEvents = numberSetting(settings, 'maxEvents', DEFAULT_MAX_EVENTS);
  const { data, loading, error } = useApiResource<NaturalEvent[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchNaturalEvents(),
    isValue: isNaturalEvents,
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

  const located = useMemo(
    () => pickDiverse((data ?? []).filter(hasLocation), maxEvents),
    [data, maxEvents],
  );

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const markers: GlobeMarker[] = located.map((event) => ({
      id: event.id,
      position: geodeticToSceneVector(event.latitude, event.longitude, 0, EARTH_RADIUS_UNITS),
      color: categoryHex(event.category),
      label: shortTitle(event.title),
    }));
    scene.setMarkers(markers);
  }, [located]);

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of located) {
      counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [located]);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && located.length === 0 && (
        <p className="card-status globe-overlay">No located events.</p>
      )}
      {!sceneError && !loading && !error && legend.length > 0 && (
        <div className="globe-legend">
          {legend.map(([category, count]) => (
            <span key={category} className="globe-legend-item">
              <span className="globe-legend-swatch" style={{ backgroundColor: hexToCss(categoryHex(category)) }} />
              {category} ({count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
