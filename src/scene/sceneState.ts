import type { CardSettingValue, CardSettingValues } from '../layout/types';

// Scene view state, persisted under its own key. Sanitized field by field
// (like globalSettings) so storage from an older version keeps what it can.

export const SCENE_STORAGE_KEY = 'space-radar:scene:v1';
export const UI_MODE_STORAGE_KEY = 'space-radar:ui-mode:v1';

export type UiMode = 'scene' | 'dashboard';
export type SceneId = 'earth' | 'sun' | 'solar-system';
export const SCENE_IDS: SceneId[] = ['earth', 'sun', 'solar-system'];

export interface SceneState {
  scene: SceneId;
  enabledLayers: string[];
  layerSettings: Record<string, CardSettingValues>;
  earthStyle: string;
}

export const EARTH_STYLES = ['globe', 'map', 'satellite'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSettingValue(value: unknown): value is CardSettingValue {
  return (
    typeof value === 'number' ||
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isSceneId(value: unknown): value is SceneId {
  return value === 'earth' || value === 'sun' || value === 'solar-system';
}

export function defaultSceneState(defaultLayers: string[]): SceneState {
  return { scene: 'earth', enabledLayers: [...defaultLayers], layerSettings: {}, earthStyle: 'globe' };
}

export function sanitizeSceneState(raw: unknown, knownLayers: string[], defaultLayers: string[]): SceneState {
  const fallback = defaultSceneState(defaultLayers);
  if (!isRecord(raw)) {
    return fallback;
  }
  const known = new Set(knownLayers);
  const enabledLayers = Array.isArray(raw.enabledLayers)
    ? raw.enabledLayers.filter((id): id is string => typeof id === 'string' && known.has(id))
    : fallback.enabledLayers;
  const layerSettings: Record<string, CardSettingValues> = {};
  if (isRecord(raw.layerSettings)) {
    for (const [id, values] of Object.entries(raw.layerSettings)) {
      if (!known.has(id) || !isRecord(values)) {
        continue;
      }
      const clean: CardSettingValues = {};
      for (const [key, value] of Object.entries(values)) {
        if (isSettingValue(value)) {
          clean[key] = value;
        }
      }
      layerSettings[id] = clean;
    }
  }
  return {
    scene: isSceneId(raw.scene) ? raw.scene : fallback.scene,
    enabledLayers: [...new Set(enabledLayers)],
    layerSettings,
    earthStyle: typeof raw.earthStyle === 'string' && EARTH_STYLES.includes(raw.earthStyle) ? raw.earthStyle : fallback.earthStyle,
  };
}

export function toggleLayer(state: SceneState, id: string): SceneState {
  const enabledLayers = state.enabledLayers.includes(id)
    ? state.enabledLayers.filter((layer) => layer !== id)
    : [...state.enabledLayers, id];
  return { ...state, enabledLayers };
}

export function changeLayerSetting(state: SceneState, id: string, key: string, value: CardSettingValue): SceneState {
  return { ...state, layerSettings: { ...state.layerSettings, [id]: { ...state.layerSettings[id], [key]: value } } };
}

export function sanitizeUiMode(raw: unknown): UiMode {
  // The Scene is the default for everyone — including visitors whose storage
  // predates it (no key at all).
  return raw === 'dashboard' ? 'dashboard' : 'scene';
}
