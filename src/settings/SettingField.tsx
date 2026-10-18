import type { CardSettingDefinition, CardSettingValue, CardSettingValues } from './types';
import { SelectField } from './SelectField';
import { SliderField } from './SliderField';

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
    // Keep at least one option selected so the layer always has data to show.
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

// One settings control for any CardSettingDefinition kind. Shared by the
// dashboard's CardSettingsPopup and the Scene view's layer panel.
export function SettingField({
  idPrefix,
  definition,
  values,
  onChangeSetting,
}: {
  /** Unique per field on the page — ids are `${idPrefix}-${option}` etc. */
  idPrefix: string;
  definition: CardSettingDefinition;
  values: CardSettingValues;
  onChangeSetting: (id: string, value: CardSettingValue) => void;
}) {
  const stored = values[definition.id];
  if (definition.kind === 'multiselect') {
    const selected = Array.isArray(stored) ? stored : definition.defaultValue;
    return (
      <MultiSelectField
        idPrefix={idPrefix}
        label={definition.label}
        options={definition.options}
        selected={selected}
        onChange={(next) => onChangeSetting(definition.id, next)}
      />
    );
  }
  if (definition.kind === 'select') {
    const value = typeof stored === 'string' ? stored : definition.defaultValue;
    return (
      <SelectField
        idPrefix={idPrefix}
        label={definition.label}
        options={definition.options}
        value={value}
        onChange={(next) => onChangeSetting(definition.id, next)}
      />
    );
  }
  return (
    <SliderField
      id={idPrefix}
      label={definition.label}
      value={typeof stored === 'number' ? stored : definition.defaultValue}
      min={definition.min}
      max={definition.max}
      step={definition.step}
      onChange={(value) => onChangeSetting(definition.id, value)}
    />
  );
}

