import type { CardDefinition, CardLayoutRect, CardSettingValues, StoredLayoutState } from './types';

export const STORAGE_KEY = 'space-radar:layout:v1';

export function defaultState(registry: CardDefinition[]): StoredLayoutState {
  const visibleIds = registry.filter((card) => card.defaultVisible).map((card) => card.id);
  const layout: Record<string, CardLayoutRect> = {};
  for (const card of registry) {
    layout[card.id] = { ...card.defaultLayout };
  }
  return { visibleIds, layout, settings: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRect(value: unknown): value is CardLayoutRect {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.w === 'number' &&
    typeof value.h === 'number'
  );
}

function isStoredShape(
  value: unknown,
): value is { visibleIds: unknown[]; layout: Record<string, unknown>; settings?: unknown } {
  return isRecord(value) && Array.isArray(value.visibleIds) && isRecord(value.layout);
}

function sanitizeSettings(raw: unknown, card: CardDefinition): CardSettingValues {
  const values: CardSettingValues = {};
  if (!isRecord(raw) || !card.settings) {
    return values;
  }
  for (const definition of card.settings) {
    const stored = raw[definition.id];
    if (definition.kind === 'number') {
      if (typeof stored === 'number' && Number.isFinite(stored)) {
        values[definition.id] = Math.min(definition.max, Math.max(definition.min, stored));
      }
    } else if (Array.isArray(stored)) {
      const allowed = new Set(definition.options.map((option) => option.value));
      const filtered = stored.filter((item): item is string => typeof item === 'string' && allowed.has(item));
      // Drop an empty selection so the schema default takes over — every
      // multiselect card needs at least one option to have anything to show.
      if (filtered.length > 0) {
        values[definition.id] = filtered;
      }
    }
  }
  return values;
}

export function sanitizeState(raw: unknown, registry: CardDefinition[]): StoredLayoutState {
  const fallback = defaultState(registry);
  if (!isStoredShape(raw)) {
    return fallback;
  }

  const knownIds = new Set(registry.map((card) => card.id));
  const visibleIds = raw.visibleIds.filter((id): id is string => typeof id === 'string' && knownIds.has(id));

  const layout: Record<string, CardLayoutRect> = {};
  const settings: Record<string, CardSettingValues> = {};
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  for (const card of registry) {
    const storedRect = raw.layout[card.id];
    layout[card.id] = isRect(storedRect) ? storedRect : { ...card.defaultLayout };
    settings[card.id] = sanitizeSettings(rawSettings[card.id], card);
  }

  return { visibleIds, layout, settings };
}

export function toggleVisibility(state: StoredLayoutState, id: string): StoredLayoutState {
  const isVisible = state.visibleIds.includes(id);
  const visibleIds = isVisible
    ? state.visibleIds.filter((visibleId) => visibleId !== id)
    : [...state.visibleIds, id];
  return { ...state, visibleIds };
}

export function applyLayoutChange(
  state: StoredLayoutState,
  rects: Record<string, CardLayoutRect>,
): StoredLayoutState {
  return {
    ...state,
    layout: { ...state.layout, ...rects },
  };
}

export function applySettingsChange(
  state: StoredLayoutState,
  id: string,
  values: CardSettingValues,
): StoredLayoutState {
  return {
    ...state,
    settings: { ...state.settings, [id]: { ...state.settings[id], ...values } },
  };
}

/** Effective settings for a card: stored values over schema defaults. */
export function cardSettingsWithDefaults(card: CardDefinition, stored: CardSettingValues | undefined): CardSettingValues {
  const values: CardSettingValues = {};
  for (const definition of card.settings ?? []) {
    values[definition.id] = stored?.[definition.id] ?? definition.defaultValue;
  }
  return values;
}

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
