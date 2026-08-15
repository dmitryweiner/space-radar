import { useCallback, useEffect, useState } from 'react';
import {
  STORAGE_KEY,
  applyLayoutChange,
  applyMobileOrderChange,
  applySettingsChange,
  defaultState,
  sanitizeState,
  toggleVisibility,
} from './layoutState';
import type { CardDefinition, CardLayoutRect, CardSettingValues, StoredLayoutState } from './types';

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

  const updateCardSettings = useCallback((id: string, values: CardSettingValues) => {
    setState((prev) => applySettingsChange(prev, id, values));
  }, []);

  const updateMobileOrder = useCallback((order: string[]) => {
    setState((prev) => applyMobileOrderChange(prev, order));
  }, []);

  return {
    visibleIds: state.visibleIds,
    layout: state.layout,
    cardSettings: state.settings,
    mobileOrder: state.mobileOrder,
    toggleVisible,
    updateLayout,
    resetLayout,
    updateCardSettings,
    updateMobileOrder,
  };
}
