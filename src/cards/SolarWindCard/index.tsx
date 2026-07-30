import { useApiResource } from '../../hooks/useApiResource';
import { fetchSolarWind } from '../../api/swpc';
import type { SolarWindPoint } from '../../api/types';

const CACHE_KEY = 'space-radar:solar-wind';
const TTL_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;
const CHART_WIDTH = 100;
const CHART_HEIGHT = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isSolarWindPoints(value: unknown): value is SolarWindPoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.time === 'string' &&
        isNullableNumber(item.density) &&
        isNullableNumber(item.speed) &&
        isNullableNumber(item.temperature),
    )
  );
}

function polylinePoints(points: SolarWindPoint[], accessor: (point: SolarWindPoint) => number | null): string {
  const values = points.map(accessor).filter((value): value is number => value !== null);
  if (values.length === 0) {
    return '';
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = CHART_WIDTH / Math.max(points.length - 1, 1);

  const coords: string[] = [];
  points.forEach((point, i) => {
    const value = accessor(point);
    if (value === null) {
      return;
    }
    const y = CHART_HEIGHT - ((value - min) / range) * CHART_HEIGHT;
    coords.push(`${i * step},${y.toFixed(1)}`);
  });
  return coords.join(' ');
}

function formatValue(value: number | null, unit: string, digits = 0): string {
  return value === null ? '—' : `${value.toFixed(digits)} ${unit}`;
}

interface SubChartProps {
  testId: string;
  label: string;
  points: string;
}

function SubChart({ testId, label, points }: SubChartProps) {
  return (
    <div className="solar-wind-subchart">
      <span className="solar-wind-subchart-label">{label}</span>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="solar-wind-svg"
        data-testid={testId}
        role="img"
        aria-label={label}
      >
        <polyline points={points} fill="none" stroke="var(--series-1)" strokeWidth={2} />
      </svg>
    </div>
  );
}

export function SolarWindCard() {
  const { data, loading, error } = useApiResource<SolarWindPoint[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchSolarWind(),
    isValue: isSolarWindPoints,
  });

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="card-status">No data available.</p>;
  }

  const points = data.slice(-48);
  const latest = points[points.length - 1];

  return (
    <div className="solar-wind-chart">
      <SubChart testId="solar-wind-speed-chart" label="Speed (km/s)" points={polylinePoints(points, (p) => p.speed)} />
      <SubChart
        testId="solar-wind-density-chart"
        label="Density (p/cm³)"
        points={polylinePoints(points, (p) => p.density)}
      />
      <p className="chart-status-line">
        Speed: <strong>{formatValue(latest.speed, 'km/s')}</strong> · Density:{' '}
        <strong>{formatValue(latest.density, 'p/cm³', 1)}</strong>
      </p>
    </div>
  );
}
