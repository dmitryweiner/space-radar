import type { CardSettingValues } from './types';

/** Read a numeric setting, falling back when absent or the wrong type. */
export function numberSetting(values: CardSettingValues, id: string, fallback: number): number {
  const value = values[id];
  return typeof value === 'number' ? value : fallback;
}

/** Read a multiselect setting, falling back when absent or the wrong type. */
export function listSetting(values: CardSettingValues, id: string, fallback: string[]): string[] {
  const value = values[id];
  return Array.isArray(value) ? value : fallback;
}

