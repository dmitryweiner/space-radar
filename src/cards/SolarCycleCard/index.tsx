import { useMemo } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchSolarCycle } from '../../api/swpc';
import type { SolarCycleData } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';

const CACHE_KEY = 'space-radar:solar-cycle';
const TTL_MS = 12 * 60 * 60 * 1000;
const POLL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_YEARS = 14;
const CHART_W = 100;
const CHART_H = 60;
const Y_PAD = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isSolarCycleData(value: unknown): value is SolarCycleData {
  if (!isRecord(value) || !Array.isArray(value.observed) || !Array.isArray(value.predicted)) {
    return false;
  }
  return (
    value.observed.every(
      (item) =>
        isRecord(item) &&
        typeof item.time === 'string' &&
        isNullableNumber(item.ssn) &&
        isNullableNumber(item.smoothedSsn) &&
        isNullableNumber(item.f107),
    ) &&
    value.predicted.every(
      (item) => isRecord(item) && typeof item.time === 'string' && isNullableNumber(item.predictedSsn),
    )
  );
}

// "YYYY-MM" → a continuous month index (year*12 + month-1) for positioning.
function monthIndex(time: string): number {
  const [year, month] = time.split('-').map(Number);
  return year * 12 + (month - 1);
}

interface Sample {
  idx: number;
  value: number;
}

export function SolarCycleCard({ settings = {} }: CardComponentProps) {
  const years = numberSetting(settings, 'years', DEFAULT_YEARS);
  const { data, loading, error } = useApiResource<SolarCycleData>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchSolarCycle(),
    isValue: isSolarCycleData,
  });

  const chart = useMemo(() => {
    if (!data || data.observed.length === 0) {
      return null;
    }
    const lastObserved = data.observed[data.observed.length - 1];
    const nowIdx = monthIndex(lastObserved.time);
    const minIdx = nowIdx - years * 12;

    // Prefer the 13-month smoothed curve; recent months lack it, so fall back to
    // the raw monthly SSN there.
    const observed: Sample[] = data.observed
      .map((point) => ({ idx: monthIndex(point.time), value: point.smoothedSsn ?? point.ssn }))
      .filter((sample): sample is Sample => sample.value !== null && sample.idx >= minIdx);

    const predicted: Sample[] = data.predicted
      .map((point) => ({ idx: monthIndex(point.time), value: point.predictedSsn }))
      .filter((sample): sample is Sample => sample.value !== null && sample.idx > nowIdx);

    const maxIdx = predicted.length > 0 ? predicted[predicted.length - 1].idx : nowIdx;
    const span = Math.max(1, maxIdx - minIdx);
    const maxValue = Math.max(1, ...observed.map((s) => s.value), ...predicted.map((s) => s.value));

    const toX = (idx: number) => ((idx - minIdx) / span) * CHART_W;
    const toY = (value: number) => CHART_H - Y_PAD - (value / maxValue) * (CHART_H - Y_PAD * 2);
    const toPolyline = (samples: Sample[]) =>
      samples.map((s) => `${toX(s.idx).toFixed(2)},${toY(s.value).toFixed(2)}`).join(' ');

    // Bridge the observed line into the prediction for a continuous curve.
    const predictedLine =
      predicted.length > 0
        ? [{ idx: nowIdx, value: observed.length > 0 ? observed[observed.length - 1].value : predicted[0].value }, ...predicted]
        : [];

    const startYear = Math.ceil(minIdx / 12);
    const endYear = Math.floor(maxIdx / 12);
    const yearTicks: { year: number; x: number }[] = [];
    const step = Math.max(1, Math.round((endYear - startYear) / 6));
    for (let year = startYear; year <= endYear; year += step) {
      yearTicks.push({ year, x: toX(year * 12) });
    }

    const latest = lastObserved.smoothedSsn ?? lastObserved.ssn;
    return {
      observedPoints: toPolyline(observed),
      predictedPoints: toPolyline(predictedLine),
      nowX: toX(nowIdx),
      yearTicks,
      latest,
      latestF107: lastObserved.f107,
      latestTime: lastObserved.time,
    };
  }, [data, years]);

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!chart) {
    return <p className="card-status">No solar-cycle data available.</p>;
  }

  return (
    <div className="solar-cycle-card">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        className="solar-cycle-svg"
        role="img"
        aria-label="Sunspot number over the solar cycle, observed and predicted"
      >
        <line x1={chart.nowX} y1={0} x2={chart.nowX} y2={CHART_H} className="solar-cycle-now" />
        {chart.predictedPoints && (
          <polyline points={chart.predictedPoints} className="solar-cycle-predicted" fill="none" />
        )}
        <polyline points={chart.observedPoints} className="solar-cycle-observed" fill="none" />
      </svg>
      <div className="solar-cycle-axis" data-testid="solar-cycle-axis">
        {chart.yearTicks.map((tick) => (
          <span
            key={tick.year}
            className="time-axis-label"
            style={{ left: `${Math.min(98, Math.max(0, tick.x)).toFixed(1)}%`, transform: 'translateX(-50%)' }}
          >
            {tick.year}
          </span>
        ))}
      </div>
      <p className="kp-status-line">
        Smoothed SSN: <strong>{chart.latest !== null ? chart.latest.toFixed(1) : '—'}</strong>
        {chart.latestF107 !== null && <span className="apod-copyright"> · F10.7 {chart.latestF107.toFixed(0)}</span>}
      </p>
      <p className="chart-timestamp">
        Observed → {chart.latestTime} · dashed = SWPC forecast · Source: NOAA SWPC
      </p>
    </div>
  );
}
