import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { projectToDisk, solarAngularRadiusArcsec, solarB0Deg } from '../astro/sunDisk';
import type { CardSettingValues } from '../settings/types';
import type { SunFrame, SunLayerDefinition, SunMarker } from '../layers/types';
import { diskRadiusFraction, sunChannel, sunImageUrl } from './sunImagery';
import { SUN_VIEW_HOME, clampSunView, panSunView, zoomSunViewAt, type SunView } from './sunView';
import { XrayTimeline } from './XrayTimeline';
import type { InspectorPanelId } from './panels';
import { useReportLayerState, type LayerSelection, type LayerStatesRef, type OnLayerStatus } from './layerHost';

const IMAGE_REFRESH_MS = 15 * 60 * 1000;
const GEOMETRY_REFRESH_MS = 60 * 60 * 1000;
const KEY_ZOOM_FACTOR = 1.25;
// A press that moves less than this is a click (a marker pick), not a drag.
const DRAG_THRESHOLD_PX = 4;
const GRID_STEP_DEG = 15;

interface SunLayerHostProps {
  layer: SunLayerDefinition;
  settings: CardSettingValues;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
  onFrame: (id: string, frame: SunFrame | null) => void;
}

// Renders nothing: runs one layer's hook and hands its frame to the stage.
function SunLayerHost({ layer, settings, statesRef, onStatus, onFrame }: SunLayerHostProps) {
  // The Sun tab is always "now" — there's no scrubber here.
  const state = layer.useLayer(settings, null);
  useReportLayerState(layer.id, state, statesRef, onStatus);
  const { frame } = state;
  useEffect(() => onFrame(layer.id, frame), [layer.id, frame, onFrame]);
  useEffect(() => () => onFrame(layer.id, null), [layer.id, onFrame]);
  return null;
}

/** Heliographic grid lines as SVG paths in disk-radius units (only the Earth-facing parts). */
function gridPaths(b0: number): string[] {
  const paths: string[] = [];
  const trace = (points: { latDeg: number; lonDeg: number }[]) => {
    let d = '';
    let pen = false;
    for (const point of points) {
      const p = projectToDisk(point, b0);
      if (!p.visible) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${p.x.toFixed(4)},${(-p.y).toFixed(4)}`;
      pen = true;
    }
    if (d) paths.push(d);
  };
  for (let lat = -75; lat <= 75; lat += GRID_STEP_DEG) {
    trace(Array.from({ length: 73 }, (_, i) => ({ latDeg: lat, lonDeg: -180 + i * 5 })));
  }
  for (let lon = -180; lon < 180; lon += GRID_STEP_DEG) {
    trace(Array.from({ length: 37 }, (_, i) => ({ latDeg: -90 + i * 5, lonDeg: lon })));
  }
  return paths;
}

function starPoints(radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    points.push(`${(r * Math.cos(angle)).toFixed(4)},${(r * Math.sin(angle)).toFixed(4)}`);
  }
  return points.join(' ');
}

interface PlacedMarker {
  layerId: string;
  marker: SunMarker;
  cx: number;
  cy: number;
}

interface SunStageProps {
  layers: SunLayerDefinition[];
  layerSettings: Record<string, CardSettingValues>;
  wavelength: string;
  labelScale: number;
  dataSaver?: boolean;
  selection: LayerSelection | null;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
  onSelect: (selection: LayerSelection) => void;
  onOpenPanel: (panel: InspectorPanelId) => void;
}

export function SunStage({
  layers,
  layerSettings,
  wavelength,
  labelScale,
  dataSaver = false,
  selection,
  statesRef,
  onStatus,
  onSelect,
  onOpenPanel,
}: SunStageProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [baseSize, setBaseSize] = useState(0);
  const [view, setView] = useState<SunView>(SUN_VIEW_HOME);
  const [frames, setFrames] = useState<Record<string, SunFrame>>({});
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [loaded, setLoaded] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const channel = sunChannel(wavelength);
  const src = `${sunImageUrl(channel.value, dataSaver)}?t=${cacheBust}`;

  useEffect(() => {
    const interval = setInterval(() => setCacheBust(Date.now()), IMAGE_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // B0 and the apparent radius change by a fraction of a degree a day.
  const [geometryAt, setGeometryAt] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setGeometryAt(Date.now()), GEOMETRY_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
  const geometry = useMemo(() => {
    const date = new Date(geometryAt);
    return { b0: solarB0Deg(date), radiusArcsec: solarAngularRadiusArcsec(date) };
  }, [geometryAt]);
  const diskRadius = diskRadiusFraction(channel, geometry.radiusArcsec);

  // The image is a square fitted into the viewport.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const size = Math.min(element.clientWidth, element.clientHeight);
      setBaseSize(size);
      setView((current) => clampSunView(current, size));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onFrame = useCallback((id: string, frame: SunFrame | null) => {
    setFrames((prev) => {
      if (frame === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev[id] === frame ? prev : { ...prev, [id]: frame };
    });
  }, []);

  // ---- pan / zoom -------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; dragging: boolean; pinchDistance: number | null }>({
    startX: 0,
    startY: 0,
    dragging: false,
    pinchDistance: null,
  });
  const hovered = useRef(false);

  const centreOffset = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: event.clientX, startY: event.clientY, dragging: false, pinchDistance: null };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.dragging = true;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = centreOffset((a.x + b.x) / 2, (a.y + b.y) / 2);
      const factor = g.pinchDistance ? distance / g.pinchDistance : 1;
      g.pinchDistance = distance;
      // Half the pointer's own move pans (the midpoint moves by half of it).
      setView((v) => panSunView(zoomSunViewAt(v, factor, mid.x, mid.y, baseSize), (current.x - previous.x) / 2, (current.y - previous.y) / 2, baseSize));
      return;
    }
    if (!g.dragging && Math.hypot(current.x - g.startX, current.y - g.startY) > DRAG_THRESHOLD_PX) {
      g.dragging = true;
      viewportRef.current?.setPointerCapture?.(event.pointerId);
    }
    if (g.dragging) {
      setView((v) => panSunView(v, current.x - previous.x, current.y - previous.y, baseSize));
    }
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.pinchDistance = null;
  }

  // Wheel needs a non-passive listener to stop the page from zooming.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = centreOffset(event.clientX, event.clientY);
      setView((v) => zoomSunViewAt(v, Math.exp(-event.deltaY * 0.0015), point.x, point.y, baseSize));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [baseSize, centreOffset]);

  // +/- zoom the disk the pointer is over, like the 3D scenes (hover-routed).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!hovered.current || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const zoomIn = event.key === '+' || event.key === '=';
      const zoomOut = event.key === '-' || event.key === '_';
      if (!zoomIn && !zoomOut) return;
      event.preventDefault();
      setView((v) => zoomSunViewAt(v, zoomIn ? KEY_ZOOM_FACTOR : 1 / KEY_ZOOM_FACTOR, 0, 0, baseSize));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [baseSize]);

  function pick(layerId: string, id: string) {
    if (gesture.current.dragging) return;
    onSelect({ layerId, hit: { kind: 'marker', id } });
  }

  // ---- overlay ----------------------------------------------------------
  // SVG units: the image spans -1..1; one CSS px is this many units.
  const unitsPerPx = baseSize > 0 ? 2 / (baseSize * view.scale) : 0;
  const showGrid = Object.values(frames).some((frame) => frame.grid);
  const grid = useMemo(() => (showGrid ? gridPaths(geometry.b0) : []), [showGrid, geometry.b0]);

  const placed: PlacedMarker[] = [];
  for (const layer of layers) {
    for (const marker of frames[layer.id]?.markers ?? []) {
      const p = projectToDisk(marker, geometry.b0);
      if (p.visible) placed.push({ layerId: layer.id, marker, cx: p.x * diskRadius, cy: -p.y * diskRadius });
    }
  }
  const selectedKey = selection ? `${selection.layerId}:${selection.hit.kind === 'marker' ? selection.hit.id : ''}` : null;
  const px = (n: number) => n * labelScale * unitsPerPx;
  const imageReady = loaded === src;

  return (
    <div className="sun-stage" data-testid="sun-stage">
      <div
        ref={viewportRef}
        className="sun-viewport"
        data-testid="sun-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerEnter={() => (hovered.current = true)}
        onPointerLeave={(event) => {
          hovered.current = false;
          if (!gesture.current.dragging) onPointerEnd(event);
        }}
        onDoubleClick={() => setView(SUN_VIEW_HOME)}
      >
        {baseSize > 0 && (
          <div
            className="sun-disk"
            style={{
              width: baseSize,
              height: baseSize,
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
            <img
              key={src}
              src={src}
              alt={`The Sun now, SDO ${channel.label}`}
              className="sun-disk-img"
              draggable={false}
              onLoad={() => {
                setLoaded(src);
                setImageError(null);
              }}
              onError={() => setImageError('The SDO image did not load — try again in a few minutes.')}
            />
            {unitsPerPx > 0 && (
              <svg className="sun-overlay" viewBox="-1 -1 2 2" data-testid="sun-overlay">
                {grid.length > 0 && (
                  <g className="sun-grid">
                    <circle cx={0} cy={0} r={diskRadius} />
                    {grid.map((d) => (
                      <path key={d} d={d} transform={`scale(${diskRadius})`} />
                    ))}
                  </g>
                )}
                {placed.map(({ layerId, marker, cx, cy }) => {
                  const r = px(marker.sizePx / 2);
                  const selected = selectedKey === `${layerId}:${marker.id}`;
                  return (
                    <g
                      key={`${layerId}:${marker.id}`}
                      className={`sun-marker sun-marker-${marker.shape}${selected ? ' sun-marker-selected' : ''}`}
                      transform={`translate(${cx.toFixed(4)} ${cy.toFixed(4)})`}
                      data-testid="sun-marker"
                      onClick={() => pick(layerId, marker.id)}
                    >
                      <title>{marker.label}</title>
                      {/* Hit target bigger than the mark. */}
                      <circle className="sun-marker-hit" r={Math.max(r, px(9))} />
                      {marker.shape === 'ring' ? (
                        <circle r={r} stroke={marker.color} />
                      ) : (
                        <polygon points={starPoints(r)} fill={marker.color} />
                      )}
                      {selected && <circle className="sun-marker-halo" r={r + px(5)} />}
                      {marker.label && (
                        <text
                          x={marker.labelSide === 'left' ? -(r + px(3)) : r + px(3)}
                          y={px(4)}
                          textAnchor={marker.labelSide === 'left' ? 'end' : 'start'}
                          fontSize={px(11)}
                          style={{ strokeWidth: px(3) }}
                        >
                          {marker.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
        {!imageReady && !imageError && <p className="card-status sun-status">Loading the latest SDO image…</p>}
        {imageError && <p className="card-status card-status-error sun-status">{imageError}</p>}
        <div className="sun-caption">
          <span className="sun-caption-title">SDO · {channel.label}</span>
          <span className="sun-caption-hint">{channel.hint}</span>
        </div>
        <div className="sun-compass" aria-hidden="true">
          <span className="sun-compass-n">N</span>
          <span className="sun-compass-e">E</span>
          <span className="sun-compass-w">W</span>
        </div>
        {view.scale > 1 && (
          <button type="button" className="tb-btn sun-reset" onClick={() => setView(SUN_VIEW_HOME)}>
            Fit disk
          </button>
        )}
      </div>
      <XrayTimeline onOpenFlares={() => onOpenPanel('flares')} />
      {layers.map((layer) => (
        <SunLayerHost
          key={layer.id}
          layer={layer}
          settings={layerSettings[layer.id] ?? {}}
          statesRef={statesRef}
          onStatus={onStatus}
          onFrame={onFrame}
        />
      ))}
    </div>
  );
}
