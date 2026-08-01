import type {
  CardDefinition,
  CardLayoutRect,
  CardSettingDefinition,
  CardSettingValue,
  CardSettingValues,
} from './types';
import { GRID_COLS } from './GridLayout';

const MAX_ROWS = 8;

interface CardSettingsPopupProps {
  card: CardDefinition;
  rect: CardLayoutRect;
  values: CardSettingValues;
  onResize: (w: number, h: number) => void;
  onChangeSetting: (id: string, value: CardSettingValue) => void;
  onClose: () => void;
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <label className="settings-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
      />
    </label>
  );
}

interface MultiSelectFieldProps {
  idPrefix: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectField({ idPrefix, label, options, selected, onChange }: MultiSelectFieldProps) {
  function toggle(value: string) {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    // Keep at least one option selected so the card always has data to show.
    if (next.length > 0) {
      onChange(next);
    }
  }
  return (
    <div className="settings-field settings-field-multiselect">
      <span>{label}</span>
      <div className="settings-checkbox-list">
        {options.map((option) => (
          <label key={option.value} className="settings-checkbox" htmlFor={`${idPrefix}-${option.value}`}>
            <input
              id={`${idPrefix}-${option.value}`}
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function SettingField({
  card,
  definition,
  values,
  onChangeSetting,
}: {
  card: CardDefinition;
  definition: CardSettingDefinition;
  values: CardSettingValues;
  onChangeSetting: (id: string, value: CardSettingValue) => void;
}) {
  const stored = values[definition.id];
  if (definition.kind === 'multiselect') {
    const selected = Array.isArray(stored) ? stored : definition.defaultValue;
    return (
      <MultiSelectField
        idPrefix={`${card.id}-setting-${definition.id}`}
        label={definition.label}
        options={definition.options}
        selected={selected}
        onChange={(next) => onChangeSetting(definition.id, next)}
      />
    );
  }
  return (
    <NumberField
      id={`${card.id}-setting-${definition.id}`}
      label={definition.label}
      value={typeof stored === 'number' ? stored : definition.defaultValue}
      min={definition.min}
      max={definition.max}
      step={definition.step}
      onChange={(value) => onChangeSetting(definition.id, value)}
    />
  );
}

export function CardSettingsPopup({ card, rect, values, onResize, onChangeSetting, onClose }: CardSettingsPopupProps) {
  return (
    <div className="settings-backdrop" data-testid="card-settings-popup" onClick={onClose}>
      <div
        className="settings-popup"
        role="dialog"
        aria-label={`Settings for ${card.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-popup-header">
          <span className="settings-popup-title">{card.title}</span>
          <button type="button" className="card-shell-action" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <NumberField
          id={`${card.id}-setting-w`}
          label="Width (columns)"
          value={rect.w}
          min={card.defaultLayout.minW ?? 1}
          max={card.defaultLayout.maxW ?? GRID_COLS}
          onChange={(w) => onResize(w, rect.h)}
        />
        <NumberField
          id={`${card.id}-setting-h`}
          label="Height (rows)"
          value={rect.h}
          min={card.defaultLayout.minH ?? 1}
          max={card.defaultLayout.maxH ?? MAX_ROWS}
          onChange={(h) => onResize(rect.w, h)}
        />
        {(card.settings ?? []).map((definition) => (
          <SettingField
            key={definition.id}
            card={card}
            definition={definition}
            values={values}
            onChangeSetting={onChangeSetting}
          />
        ))}
      </div>
    </div>
  );
}
