import { useCallback, useEffect, useState } from 'react';
import type { CardSettingValue } from '../layout/types';
import {
  SCENE_STORAGE_KEY,
  UI_MODE_STORAGE_KEY,
  changeLayerSetting,
  defaultSceneState,
  sanitizeSceneState,
  sanitizeUiMode,
  toggleLayer,
  type SceneId,
  type SceneState,
  type UiMode,
} from './sceneState';

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked — state just won't persist.
  }
}

export function useUiMode() {
  const [mode, setMode] = useState<UiMode>(() => sanitizeUiMode(readJson(UI_MODE_STORAGE_KEY)));
  useEffect(() => writeJson(UI_MODE_STORAGE_KEY, mode), [mode]);
  return [mode, setMode] as const;
}

export function useSceneState(knownLayers: string[], defaultLayers: string[]) {
  const [state, setState] = useState<SceneState>(() => {
    const raw = readJson(SCENE_STORAGE_KEY);
    return raw === null ? defaultSceneState(defaultLayers) : sanitizeSceneState(raw, knownLayers, defaultLayers);
  });
  useEffect(() => writeJson(SCENE_STORAGE_KEY, state), [state]);

  const setScene = useCallback((scene: SceneId) => setState((prev) => ({ ...prev, scene })), []);
  const toggle = useCallback((id: string) => setState((prev) => toggleLayer(prev, id)), []);
  const setLayerSetting = useCallback(
    (id: string, key: string, value: CardSettingValue) => setState((prev) => changeLayerSetting(prev, id, key, value)),
    [],
  );
  const setEarthStyle = useCallback((earthStyle: string) => setState((prev) => ({ ...prev, earthStyle })), []);
  return { state, setScene, toggle, setLayerSetting, setEarthStyle };
}
