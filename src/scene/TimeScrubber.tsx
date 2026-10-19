import { useEffect, useRef, useState } from 'react';
import type { LayerTime } from '../layers/types';
import { formatTime } from '../format/display';

const HOUR_MS = 60 * 60 * 1000;
// ±7 days — the default asteroid-flyby window, so every pass in view can be
// scrubbed through its closest approach.
export const SCRUB_RANGE_HOURS = 7 * 24;
// Playback speeds (simulated seconds per real second).
export const PLAY_SPEEDS = [60, 600, 3600, 86400];
const PLAY_TICK_MS = 100;

function speedLabel(speed: number): string {
  if (speed >= 86400) return '1 day/s';
  if (speed >= 3600) return '1 h/s';
  if (speed >= 600) return '10 min/s';
  return '1 min/s';
}

interface TimeScrubberProps {
  time: LayerTime;
  onChange: (time: LayerTime) => void;
}

// The shared time cursor: "Live" (null) by default; dragging or playing sets a
// fixed instant that every time-aware layer (satellites, terminator, flybys,
// Moon) follows. Shown in UTC or local time per the general settings.
export function TimeScrubber({ time, onChange }: TimeScrubberProps) {
  const [speed, setSpeed] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timeRef = useRef(time);
  useEffect(() => {
    timeRef.current = time;
  });

  // Keep the live clock (and the slider's "now" anchor) ticking.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (speed === null) {
      return undefined;
    }
    let last = performance.now();
    const timer = setInterval(() => {
      const tick = performance.now();
      const base = timeRef.current ?? Date.now();
      const next = base + (tick - last) * speed;
      last = tick;
      const limit = Date.now() + SCRUB_RANGE_HOURS * HOUR_MS;
      if (next >= limit) {
        setSpeed(null);
        onChange(limit);
      } else {
        onChange(next);
      }
    }, PLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [speed, onChange]);

  const shown = time ?? now;
  const offsetHours = (shown - now) / HOUR_MS;

  function cycleSpeed() {
    const index = speed === null ? 0 : PLAY_SPEEDS.indexOf(speed) + 1;
    setSpeed(index >= PLAY_SPEEDS.length ? null : PLAY_SPEEDS[index]);
  }

  return (
    <div className="time-scrubber" data-testid="time-scrubber">
      <button
        type="button"
        className={time === null ? 'tb-btn tb-btn-active time-live' : 'tb-btn time-live'}
        aria-pressed={time === null}
        onClick={() => {
          setSpeed(null);
          onChange(null);
        }}
        title="Back to the current time"
      >
        Live
      </button>
      <input
        type="range"
        className="time-range"
        aria-label="Time offset from now"
        min={-SCRUB_RANGE_HOURS}
        max={SCRUB_RANGE_HOURS}
        step={0.25}
        value={Math.max(-SCRUB_RANGE_HOURS, Math.min(SCRUB_RANGE_HOURS, offsetHours))}
        onChange={(event) => {
          setSpeed(null);
          onChange(Date.now() + Number(event.target.value) * HOUR_MS);
        }}
      />
      <button type="button" className="tb-btn time-play" onClick={cycleSpeed} title="Play forward (click again to speed up)">
        {speed === null ? '▶' : `▶ ${speedLabel(speed)}`}
      </button>
      <span className="time-label" data-testid="time-label">
        {formatTime(shown)}
        {time !== null && (
          <span className="time-offset">
            {' '}
            ({offsetHours >= 0 ? '+' : '−'}
            {Math.abs(offsetHours) >= 24 ? `${(Math.abs(offsetHours) / 24).toFixed(1)} d` : `${Math.abs(offsetHours).toFixed(1)} h`})
          </span>
        )}
      </span>
    </div>
  );
}
