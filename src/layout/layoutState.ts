import type { CardDefinition, CardLayoutRect, StoredLayoutState } from './types';

export const STORAGE_KEY = 'space-radar:layout:v1';

export function defaultState(registry: CardDefinition[]): StoredLayoutState {
  const visibleIds = registry.filter((card) => card.defaultVisible).map((card) => card.id);
  const layout: Record<string, CardLayoutRect> = {};
  for (const card of registry) {
    layout[card.id] = { ...card.defaultLayout };
  }
  return { visibleIds, layout };
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

function isStoredShape(value: unknown): value is { visibleIds: unknown[]; layout: Record<string, unknown> } {
  return isRecord(value) && Array.isArray(value.visibleIds) && isRecord(value.layout);
}

export function sanitizeState(raw: unknown, registry: CardDefinition[]): StoredLayoutState {
  const fallback = defaultState(registry);
  if (!isStoredShape(raw)) {
    return fallback;
  }

  const knownIds = new Set(registry.map((card) => card.id));
  const visibleIds = raw.visibleIds.filter((id): id is string => typeof id === 'string' && knownIds.has(id));

  const layout: Record<string, CardLayoutRect> = {};
  for (const card of registry) {
    const storedRect = raw.layout[card.id];
    layout[card.id] = isRect(storedRect) ? storedRect : { ...card.defaultLayout };
  }

  return { visibleIds, layout };
}

export function toggleVisibility(state: StoredLayoutState, id: string): StoredLayoutState {
  const isVisible = state.visibleIds.includes(id);
  const visibleIds = isVisible
    ? state.visibleIds.filter((visibleId) => visibleId !== id)
    : [...state.visibleIds, id];
  return { visibleIds, layout: state.layout };
}

export function applyLayoutChange(
  state: StoredLayoutState,
  rects: Record<string, CardLayoutRect>,
): StoredLayoutState {
  return {
    visibleIds: state.visibleIds,
    layout: { ...state.layout, ...rects },
  };
}
