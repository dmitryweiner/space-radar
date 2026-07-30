import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY, applyLayoutChange, defaultState, sanitizeState, toggleVisibility } from './layoutState';
import type { CardDefinition, CardLayoutRect, StoredLayoutState } from './types';

function loadInitialState(registry: CardDefinition[], storageKey: string): StoredLayoutState {
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) {
    return defaultState(registry);
  }
  try {
    return sanitizeState(JSON.parse(raw), registry);
  } catch {
    return defaultState(registry);
  }
}

export function useLayoutState(registry: CardDefinition[], storageKey: string = STORAGE_KEY) {
  const [state, setState] = useState<StoredLayoutState>(() => loadInitialState(registry, storageKey));

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const toggleVisible = useCallback((id: string) => {
    setState((prev) => toggleVisibility(prev, id));
  }, []);

  const updateLayout = useCallback((rects: Record<string, CardLayoutRect>) => {
    setState((prev) => applyLayoutChange(prev, rects));
  }, []);

  const resetLayout = useCallback(() => {
    setState(defaultState(registry));
  }, [registry]);

  return {
    visibleIds: state.visibleIds,
    layout: state.layout,
    toggleVisible,
    updateLayout,
    resetLayout,
  };
}
