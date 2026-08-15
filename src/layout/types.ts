import type { ComponentType } from 'react';

export interface CardLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** A numeric stepper setting shown in the card's settings popup. */
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
  /** Global label/marker scale for the Earth-globe cards, set in the header's
   * general settings popup (defaults to 1 when absent). */
  labelScale?: number;
}

export interface CardDefinition {
  id: string;
  title: string;
  defaultVisible: boolean;
  defaultLayout: CardLayoutRect;
  component: ComponentType<CardComponentProps>;
  settings?: CardSettingDefinition[];
}

export interface StoredLayoutState {
  visibleIds: string[];
  layout: Record<string, CardLayoutRect>;
  settings: Record<string, CardSettingValues>;
  /** Visible card ids in single-column (mobile) display order. Desktop
   * dragging never touches this — only the mobile grid reorders it. */
  mobileOrder: string[];
}
