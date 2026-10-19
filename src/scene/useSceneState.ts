import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardSettingValue } from '../settings/types';
import {
  SCENE_STORAGE_KEY,
  changeLayerSetting,
  defaultSceneState,
  sanitizeSceneState,
  sceneFromHash,
  sceneHash,
  toggleLayer,
  toggleSolarLayer,
  toggleSunLayer,
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

function hashScene(): SceneId | null {
  return sceneFromHash(window.location.hash);
}

export function useSceneState(
  knownLayers: string[],
  defaultLayers: string[],
  knownSolarLayers: string[] = [],
  defaultSolarLayers: string[] = [],
  knownSunLayers: string[] = [],
  defaultSunLayers: string[] = [],
  /** Overrides the stored scene tab on load (the "Open on" setting). A
   *  `#earth` / `#sun` / `#solar-system` hash in the URL overrides both. */
  initialScene: SceneId | null = null,
) {
  const [state, setState] = useState<SceneState>(() => {
    const raw = readJson(SCENE_STORAGE_KEY);
    const loaded =
      raw === null
        ? defaultSceneState(defaultLayers, defaultSolarLayers, defaultSunLayers)
        : sanitizeSceneState(raw, knownLayers, defaultLayers, knownSolarLayers, defaultSolarLayers, knownSunLayers, defaultSunLayers);
    const scene = hashScene() ?? initialScene;
    return scene ? { ...loaded, scene } : loaded;
  });
  useEffect(() => writeJson(SCENE_STORAGE_KEY, state), [state]);

  // Keep the URL hash on the current tab: the first sync replaces the
  // history entry (opening the bare URL shouldn't add one), later tab
  // switches push one so Back returns to the previous tab.
  const hashSynced = useRef(false);
  useEffect(() => {
    if (hashScene() !== state.scene) {
      const url = `${window.location.pathname}${window.location.search}${sceneHash(state.scene)}`;
      if (hashSynced.current) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    }
    hashSynced.current = true;
  }, [state.scene]);
  // Back/forward, or a hash link followed inside the open page.
  useEffect(() => {
    const onHashChange = () => {
      const scene = hashScene();
      if (scene) setState((prev) => (prev.scene === scene ? prev : { ...prev, scene }));
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  const setScene = useCallback((scene: SceneId) => setState((prev) => ({ ...prev, scene })), []);
  const toggle = useCallback((id: string) => setState((prev) => toggleLayer(prev, id)), []);
  const toggleSolar = useCallback((id: string) => setState((prev) => toggleSolarLayer(prev, id)), []);
  const toggleSun = useCallback((id: string) => setState((prev) => toggleSunLayer(prev, id)), []);
  const setLayerSetting = useCallback(
    (id: string, key: string, value: CardSettingValue) => setState((prev) => changeLayerSetting(prev, id, key, value)),
    [],
  );
  const setEarthStyle = useCallback((earthStyle: string) => setState((prev) => ({ ...prev, earthStyle })), []);
  const setSunWavelength = useCallback((sunWavelength: string) => setState((prev) => ({ ...prev, sunWavelength })), []);
  return { state, setScene, toggle, toggleSolar, toggleSun, setLayerSetting, setEarthStyle, setSunWavelength };
}
