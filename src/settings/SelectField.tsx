interface SelectFieldProps {
  idPrefix: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SelectField({ idPrefix, label, options, value, onChange }: SelectFieldProps) {
  return (
    <div className="settings-field settings-field-multiselect">
      <span>{label}</span>
      <div className="settings-checkbox-list">
        {options.map((option) => (
          <label key={option.value} className="settings-checkbox" htmlFor={`${idPrefix}-${option.value}`}>
            <input
              id={`${idPrefix}-${option.value}`}
              type="radio"
              name={idPrefix}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
