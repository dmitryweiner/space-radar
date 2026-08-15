import { useState } from 'react';

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function NumberField({ id, label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  // Track the raw text while editing so typing a multi-digit value (or briefly
  // clearing the field) isn't clamped on every keystroke — clamping mid-edit is
  // what made "type 2 into a field showing 1" land on 4/8. Commit on blur/Enter.
  const [draft, setDraft] = useState(String(value));
  // Re-sync the draft when the committed value changes (our own commit, or an
  // external layout update) — the render-time "adjust state on prop change"
  // pattern, avoiding an effect. Mid-edit `value` doesn't change, so typing a
  // multi-digit number isn't disturbed.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  function commit() {
    const next = Number(draft);
    if (Number.isFinite(next) && draft.trim() !== '') {
      // Round to the nearest step (not the nearest integer) so a fractional
      // step — e.g. 0.1 for the label-scale coefficient — works too; for the
      // default step of 1 this is identical to Math.round(next).
      const stepped = Math.round(next / step) * step;
      // Strip floating-point noise from the division above (e.g. a 0.1 step
      // landing on 0.30000000000000004).
      const rounded = Math.round(stepped * 1000) / 1000;
      const clamped = Math.min(max, Math.max(min, rounded));
      onChange(clamped);
      setDraft(String(clamped));
    } else {
      setDraft(String(value));
    }
  }

  return (
    <label className="settings-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
