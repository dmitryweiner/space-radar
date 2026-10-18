/** A numeric stepper setting (layer panel / detail panels). */
export interface NumberCardSetting {
  kind: 'number';
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
}

export interface MultiSelectOption {
  value: string;
  label: string;
}

/** A checkbox-list setting whose value is the set of selected option values. */
export interface MultiSelectCardSetting {
  kind: 'multiselect';
  id: string;
  label: string;
  options: MultiSelectOption[];
  defaultValue: string[];
}

/** A single-choice (radio) setting whose value is one option's value. */
export interface SelectCardSetting {
  kind: 'select';
  id: string;
  label: string;
  options: MultiSelectOption[];
  defaultValue: string;
}

export type CardSettingDefinition = NumberCardSetting | MultiSelectCardSetting | SelectCardSetting;

export type CardSettingValue = number | string[] | string;

export type CardSettingValues = Record<string, CardSettingValue>;

export interface CardComponentProps {
  settings?: CardSettingValues;
  /** The Scene view's shared time cursor (ms), or null/absent for live. Only
   * time-aware components (e.g. the Solar System) read it. */
  time?: number | null;
}
