import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { useSolarFlareEvents } from '../hooks/sharedResources';
import { fetchXrayFlux } from '../api/swpc';
import type { SolarFlare, XrayFluxPoint } from '../api/types';
import { formatClock, formatTime } from '../format/display';
import { useGlobalSettings } from '../settings/useGlobalSettings';
import { flareStrength } from '../layers/sunFlaresLayer';

// The Sun tab's bottom strip: the last 24 h of GOES 1–8 Å X-ray flux on the
// log scale the flare classes are defined on (A = 1e-8 W/m², each letter ×10),
// with the C-and-up flares marked. Clicking it opens the full flare list.

const MINUTE = 60 * 1000;
const WINDOW_MS = 24 * 60 * MINUTE;
const LOG_MIN = -8;
const LOG_MAX = -3;
const CLASS_LETTERS = ['A', 'B', 'C', 'M', 'X'];
const PAD = { left: 18, right: 8, top: 6, bottom: 16 };
// Only M and stronger get a text label; C flares are dots (selective labels).
const LABEL_MIN_STRENGTH = flareStrength('M');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFlux(value: unknown): value is XrayFluxPoint[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.time === 'string' && typeof item.flux === 'number');
}

/** "C2.1" for a flux in W/m². */
export function fluxClass(flux: number): string {
  const exponent = Math.floor(Math.log10(flux));
  const index = Math.min(CLASS_LETTERS.length - 1, Math.max(0, exponent + 8));
  const value = flux / 10 ** (index - 8);
  return `${CLASS_LETTERS[index]}${value.toFixed(1)}`;
}

/** Flux of a GOES class string ("M1.4" → 1.4e-5). */
export function classFlux(classType: string): number {
  const index = CLASS_LETTERS.indexOf(classType.charAt(0));
  const value = Number.parseFloat(classType.slice(1));
  return (Number.isFinite(value) ? value : 1) * 10 ** (Math.max(0, index) - 8);
}

function classColor(classType: string): string {
  switch (classType.charAt(0)) {
    case 'X':
      return 'var(--status-critical)';
    case 'M':
      return 'var(--status-serious)';
    default:
      return 'var(--status-warning)';
  }
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

interface XrayTimelineProps {
  onOpenFlares: () => void;
}

export function XrayTimeline({ onOpenFlares }: XrayTimelineProps) {
  useGlobalSettings(); // axis labels follow the time-zone setting
  const flux = useApiResource<XrayFluxPoint[]>({
    key: 'space-radar:xray-flux',
    ttlMs: 10 * MINUTE,
    pollMs: 10 * MINUTE,
    fetcher: () => fetchXrayFlux(),
    isValue: isFlux,
  });
  const flareEvents = useSolarFlareEvents();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const width = useWidth(plotRef);
  const [heightPx, setHeightPx] = useState(0);
  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setHeightPx(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const points = useMemo(
    () => (flux.data ?? []).map((p) => ({ t: Date.parse(p.time), flux: p.flux })).filter((p) => Number.isFinite(p.t)),
    [flux.data],
  );
  const end = points.length > 0 ? points[points.length - 1].t : 0;
  const start = end - WINDOW_MS;
  const flares = useMemo(
    () =>
      (flareEvents.data ?? []).filter(
        (flare: SolarFlare) => flareStrength(flare.classType) >= flareStrength('C') && Date.parse(flare.peak ?? flare.begin) >= start,
      ),
    [flareEvents.data, start],
  );

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, heightPx - PAD.top - PAD.bottom);
  const xOf = (t: number) => PAD.left + ((t - start) / WINDOW_MS) * plotW;
  const yOf = (f: number) => PAD.top + (1 - (Math.log10(f) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * plotH;

  const path = useMemo(() => {
    if (plotW <= 0 || plotH <= 0) return '';
    let d = '';
    let previous = -Infinity;
    for (const p of points) {
      if (p.t < start) continue;
      // A gap of more than 5 min in the feed breaks the line.
      d += `${p.t - previous > 5 * MINUTE ? 'M' : 'L'}${(PAD.left + ((p.t - start) / WINDOW_MS) * plotW).toFixed(1)},${(
        PAD.top +
        (1 - (Math.log10(Math.min(Math.max(p.flux, 1e-9), 1e-2)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * plotH
      ).toFixed(1)}`;
      previous = p.t;
    }
    return d;
  }, [points, start, plotW, plotH]);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const hover = useMemo(() => {
    if (hoverX === null || points.length === 0 || plotW <= 0) return null;
    const t = start + ((hoverX - PAD.left) / plotW) * WINDOW_MS;
    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    }
    return best;
  }, [hoverX, points, start, plotW]);

  const ticks = useMemo(() => {
    if (end === 0) return [];
    const result: number[] = [];
    const sixHours = 6 * 60 * MINUTE;
    for (let t = Math.ceil(start / sixHours) * sixHours; t <= end; t += sixHours) result.push(t);
    return result;
  }, [start, end]);

  return (
    <section className="xray-timeline" data-testid="xray-timeline" aria-label="GOES X-ray flux, last 24 hours">
      <div className="xray-header">
        <span className="panel-heading xray-title">X-ray flux · 24 h</span>
        {latest && (
          <span className="xray-now">
            Now <strong>{fluxClass(latest.flux)}</strong>
          </span>
        )}
        <button type="button" className="panel-link xray-open" onClick={onOpenFlares}>
          Flare list
        </button>
      </div>
      <div
        ref={plotRef}
        className="xray-plot"
        onPointerMove={(event) => setHoverX(event.clientX - event.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setHoverX(null)}
      >
        {flux.loading && <p className="card-status xray-status">Loading GOES X-rays…</p>}
        {flux.error && <p className="card-status card-status-error xray-status">{flux.error}</p>}
        {width > 0 && heightPx > 0 && points.length > 0 && (
          <svg width={width} height={heightPx} className="xray-svg" role="img" aria-label="X-ray flux chart">
            {CLASS_LETTERS.map((letter, i) => {
              const y = yOf(10 ** (i - 8));
              return (
                <g key={letter}>
                  <line className="xray-grid" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
                  <text className="xray-axis" x={PAD.left - 5} y={y - (plotH / 5) / 2 + 4} textAnchor="end">
                    {letter}
                  </text>
                </g>
              );
            })}
            {ticks.map((t) => (
              <text key={t} className="xray-axis" x={xOf(t)} y={heightPx - 3} textAnchor="middle">
                {formatClock(t)}
              </text>
            ))}
            <path className="xray-line" d={path} />
            {flares.map((flare) => {
              const t = Date.parse(flare.peak ?? flare.begin);
              const x = xOf(t);
              const y = yOf(classFlux(flare.classType));
              return (
                <g key={flare.id} className="xray-flare" onClick={onOpenFlares}>
                  <title>{`${flare.classType} · ${formatTime(t)}${flare.region !== null ? ` · region ${flare.region}` : ''}`}</title>
                  <circle cx={x} cy={y} r={10} className="xray-flare-hit" />
                  <circle cx={x} cy={y} r={4} fill={classColor(flare.classType)} className="xray-flare-dot" />
                  {flareStrength(flare.classType) >= LABEL_MIN_STRENGTH && (
                    <text className="xray-flare-label" x={x} y={y - 7} textAnchor="middle">
                      {flare.classType}
                    </text>
                  )}
                </g>
              );
            })}
            {hover && (
              <g className="xray-crosshair">
                <line x1={xOf(hover.t)} x2={xOf(hover.t)} y1={PAD.top} y2={PAD.top + plotH} />
                <circle cx={xOf(hover.t)} cy={yOf(hover.flux)} r={3.5} />
              </g>
            )}
          </svg>
        )}
        {hover && (
          <div className="xray-tooltip" style={xOf(hover.t) > width / 2 ? { right: width - xOf(hover.t) + 8 } : { left: xOf(hover.t) + 8 }}>
            <strong>{fluxClass(hover.flux)}</strong> · {formatClock(hover.t)}
          </div>
        )}
      </div>
    </section>
  );
}
