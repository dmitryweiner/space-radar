import { useCallback, useEffect, useState } from 'react';
import type { CardSettingValue } from '../settings/types';
import {
  SCENE_STORAGE_KEY,
  changeLayerSetting,
  defaultSceneState,
  sanitizeSceneState,
  toggleLayer,
  toggleSolarLayer,
  type SceneId,
  type SceneState,
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

export function useSceneState(
  knownLayers: string[],
  defaultLayers: string[],
  knownSolarLayers: string[] = [],
  defaultSolarLayers: string[] = [],
) {
  const [state, setState] = useState<SceneState>(() => {
    const raw = readJson(SCENE_STORAGE_KEY);
    return raw === null
      ? defaultSceneState(defaultLayers, defaultSolarLayers)
      : sanitizeSceneState(raw, knownLayers, defaultLayers, knownSolarLayers, defaultSolarLayers);
  });
  useEffect(() => writeJson(SCENE_STORAGE_KEY, state), [state]);

  const setScene = useCallback((scene: SceneId) => setState((prev) => ({ ...prev, scene })), []);
  const toggle = useCallback((id: string) => setState((prev) => toggleLayer(prev, id)), []);
  const toggleSolar = useCallback((id: string) => setState((prev) => toggleSolarLayer(prev, id)), []);
  const setLayerSetting = useCallback(
    (id: string, key: string, value: CardSettingValue) => setState((prev) => changeLayerSetting(prev, id, key, value)),
    [],
  );
  const setEarthStyle = useCallback((earthStyle: string) => setState((prev) => ({ ...prev, earthStyle })), []);
  return { state, setScene, toggle, toggleSolar, setLayerSetting, setEarthStyle };
}
