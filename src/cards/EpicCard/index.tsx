import { useEffect, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchEpic } from '../../api/epic';
import type { EpicFrame } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';
import { formatUtcTimestamp } from '../formatTimestamp';

const CACHE_KEY = 'space-radar:epic';
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;
const DEFAULT_FRAME_SECONDS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isEpicFrames(value: unknown): value is EpicFrame[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.image === 'string' &&
        typeof item.date === 'string' &&
        typeof item.imageUrl === 'string' &&
        isNullableNumber(item.centroidLat) &&
        isNullableNumber(item.centroidLon),
    )
  );
}

// EPIC's `date` is a UTC "YYYY-MM-DD hh:mm:ss" string; reuse the shared UTC
// formatter (it accepts a space separator) for the caption.
function frameTime(date: string): string {
  return formatUtcTimestamp(date);
}

export function EpicCard({ settings = {} }: CardComponentProps) {
  const frameSeconds = numberSetting(settings, 'frameSeconds', DEFAULT_FRAME_SECONDS);
  const { data, loading, error } = useApiResource<EpicFrame[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchEpic(),
    isValue: isEpicFrames,
  });

  const frames = data ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || frames.length < 2) {
      return;
    }
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, Math.max(0.5, frameSeconds) * 1000);
    return () => clearInterval(interval);
  }, [playing, frames.length, frameSeconds]);

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (frames.length === 0) {
    return <p className="card-status">No EPIC imagery available.</p>;
  }

  const current = frames[Math.min(index, frames.length - 1)];

  return (
    <div className="epic-card">
      <div className="epic-image-wrap">
        <img src={current.imageUrl} alt={`Earth from DSCOVR/EPIC at ${current.date} UTC`} className="epic-image" />
      </div>
      <div className="epic-controls">
        <button
          type="button"
          className="tb-btn epic-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '►'}
        </button>
        <input
          type="range"
          className="epic-slider"
          min={0}
          max={frames.length - 1}
          value={Math.min(index, frames.length - 1)}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
          aria-label="EPIC frame"
        />
        <span className="epic-frame-count">
          {index + 1}/{frames.length}
        </span>
      </div>
      <p className="chart-status-line">
        {frameTime(current.date)} · <span className="apod-copyright">DSCOVR/EPIC from L1</span>
      </p>
    </div>
  );
}
