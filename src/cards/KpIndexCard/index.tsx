import { useApiResource } from '../../hooks/useApiResource';
import { fetchKpIndex } from '../../api/swpc';
import type { KpIndexPoint } from '../../api/types';

const CACHE_KEY = 'space-radar:kp-index';
const TTL_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;
const MAX_KP = 9;
const CHART_HEIGHT = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isKpIndexPoints(value: unknown): value is KpIndexPoint[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.time === 'string' && typeof item.kp === 'number')
  );
}

interface KpStatus {
  label: string;
  color: string;
}

function kpStatus(kp: number): KpStatus {
  if (kp >= 7) {
    return { label: 'Severe storm', color: 'var(--status-critical)' };
  }
  if (kp >= 5) {
    return { label: 'Storm', color: 'var(--status-serious)' };
  }
  if (kp >= 4) {
    return { label: 'Unsettled', color: 'var(--status-warning)' };
  }
  return { label: 'Quiet', color: 'var(--status-good)' };
}

export function KpIndexCard() {
  const { data, loading, error } = useApiResource<KpIndexPoint[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchKpIndex(),
    isValue: isKpIndexPoints,
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

  const points = data.slice(-8);
  const latest = points[points.length - 1];
  const status = kpStatus(latest.kp);
  const barWidth = 100 / points.length;

  return (
    <div className="kp-chart">
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="kp-chart-svg"
        role="img"
        aria-label="Planetary Kp-index, recent readings"
      >
        {points.map((point, i) => {
          const barHeight = (point.kp / MAX_KP) * CHART_HEIGHT;
          const barStatus = kpStatus(point.kp);
          return (
            <rect
              key={point.time}
              data-testid="kp-bar"
              x={i * barWidth + barWidth * 0.15}
              y={CHART_HEIGHT - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              fill={barStatus.color}
              rx={1}
            >
              <title>{`${point.time}: Kp ${point.kp.toFixed(2)} (${barStatus.label})`}</title>
            </rect>
          );
        })}
      </svg>
      <p className="kp-status-line">
        Current: <strong>Kp {latest.kp.toFixed(2)}</strong> —{' '}
        <span style={{ color: status.color }}>{status.label}</span>
      </p>
    </div>
  );
}
