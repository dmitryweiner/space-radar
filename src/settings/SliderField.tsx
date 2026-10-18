import { useEffect, useRef } from 'react';

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

const HOLD_REPEAT_MS = 150;

// Rounds to the nearest step (not the nearest integer, so a fractional step —
// e.g. 0.1 for the label-scale coefficient — works too) and strips the
// floating-point noise that division can leave (e.g. 0.30000000000000004).
function clampToStep(next: number, min: number, max: number, step: number): number {
  const stepped = Math.round(next / step) * step;
  const rounded = Math.round(stepped * 1000) / 1000;
  return Math.min(max, Math.max(min, rounded));
}

function decimalsOf(step: number): number {
  return step % 1 === 0 ? 0 : String(step).split('.')[1]?.length ?? 0;
}

// A range slider flanked by −/+ step buttons (press-and-hold repeats), so the
// value is reachable with a thumb drag or a tap — friendlier on mobile than a
// bare <input type="number">.
export function SliderField({ id, label, value, min, max, step = 1, onChange }: SliderFieldProps) {
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Read from a ref (not the `value` prop) inside the hold-repeat interval —
  // the interval is set up once per press and its closure would otherwise see
  // a stale value across ticks. Synced in an effect, not during render, per
  // the rules-of-hooks ban on writing refs mid-render.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => stopHold, []);

  function stopHold() {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }

  function nudge(dir: 1 | -1) {
    onChange(clampToStep(valueRef.current + dir * step, min, max, step));
  }

  function startHold(dir: 1 | -1) {
    stopHold();
    nudge(dir);
    holdRef.current = setInterval(() => nudge(dir), HOLD_REPEAT_MS);
  }

  return (
    <div className="settings-field settings-field-slider">
      <div className="settings-field-slider-header">
        <label htmlFor={id}>{label}</label>
        <span className="settings-field-value">{value.toFixed(decimalsOf(step))}</span>
      </div>
      <div className="settings-slider-row">
        <button
          type="button"
          className="adj-btn"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onPointerDown={(event) => {
            event.preventDefault();
            startHold(-1);
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clampToStep(Number(event.target.value), min, max, step))}
        />
        <button
          type="button"
          className="adj-btn"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onPointerDown={(event) => {
            event.preventDefault();
            startHold(1);
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          +
        </button>
      </div>
    </div>
  );
}
