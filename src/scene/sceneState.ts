import type { CardSettingValue, CardSettingValues } from '../settings/types';

// Scene view state, persisted under its own key. Sanitized field by field
// (like globalSettings) so storage from an older version keeps what it can.

export const SCENE_STORAGE_KEY = 'space-radar:scene:v1';

export type SceneId = 'earth' | 'sun' | 'solar-system';
export const SCENE_IDS: SceneId[] = ['earth', 'sun', 'solar-system'];

export interface SceneState {
  scene: SceneId;
  enabledLayers: string[];
  /** Enabled layers of the Solar System scene. */
  solarLayers: string[];
  /** Enabled overlays of the Sun tab. */
  sunLayers: string[];
  layerSettings: Record<string, CardSettingValues>;
  earthStyle: string;
  /** The Sun tab's SDO channel (`SUN_WAVELENGTHS`). */
  sunWavelength: string;
}

export const EARTH_STYLES = ['globe', 'map', 'satellite'];
export const SUN_WAVELENGTHS = ['0193', '0171', '0304', '0131', 'HMIIF', 'HMIB'];

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

export function defaultSceneState(defaultLayers: string[], defaultSolarLayers: string[] = [], defaultSunLayers: string[] = []): SceneState {
  return {
    scene: 'earth',
    enabledLayers: [...defaultLayers],
    solarLayers: [...defaultSolarLayers],
    sunLayers: [...defaultSunLayers],
    layerSettings: {},
    earthStyle: 'globe',
    sunWavelength: '0193',
  };
}

function knownIds(raw: unknown, known: Set<string>, fallback: string[]): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && known.has(id)))] : fallback;
}

export function sanitizeSceneState(
  raw: unknown,
  knownLayers: string[],
  defaultLayers: string[],
  knownSolarLayers: string[] = [],
  defaultSolarLayers: string[] = [],
  knownSunLayers: string[] = [],
  defaultSunLayers: string[] = [],
): SceneState {
  const fallback = defaultSceneState(defaultLayers, defaultSolarLayers, defaultSunLayers);
  if (!isRecord(raw)) {
    return fallback;
  }
  const known = new Set([...knownLayers, ...knownSolarLayers, ...knownSunLayers]);
  const enabledLayers = knownIds(raw.enabledLayers, new Set(knownLayers), fallback.enabledLayers);
  // Absent in storage from before the Solar System had layers → defaults on.
  const solarLayers = knownIds(raw.solarLayers, new Set(knownSolarLayers), fallback.solarLayers);
  const sunLayers = knownIds(raw.sunLayers, new Set(knownSunLayers), fallback.sunLayers);
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
    enabledLayers,
    solarLayers,
    sunLayers,
    layerSettings,
    earthStyle: typeof raw.earthStyle === 'string' && EARTH_STYLES.includes(raw.earthStyle) ? raw.earthStyle : fallback.earthStyle,
    sunWavelength:
      typeof raw.sunWavelength === 'string' && SUN_WAVELENGTHS.includes(raw.sunWavelength) ? raw.sunWavelength : fallback.sunWavelength,
  };
}

export function toggleLayer(state: SceneState, id: string): SceneState {
  const enabledLayers = state.enabledLayers.includes(id)
    ? state.enabledLayers.filter((layer) => layer !== id)
    : [...state.enabledLayers, id];
  return { ...state, enabledLayers };
}

export function toggleSolarLayer(state: SceneState, id: string): SceneState {
  const solarLayers = state.solarLayers.includes(id)
    ? state.solarLayers.filter((layer) => layer !== id)
    : [...state.solarLayers, id];
  return { ...state, solarLayers };
}

export function toggleSunLayer(state: SceneState, id: string): SceneState {
  const sunLayers = state.sunLayers.includes(id) ? state.sunLayers.filter((layer) => layer !== id) : [...state.sunLayers, id];
  return { ...state, sunLayers };
}

export function changeLayerSetting(state: SceneState, id: string, key: string, value: CardSettingValue): SceneState {
  return { ...state, layerSettings: { ...state.layerSettings, [id]: { ...state.layerSettings[id], [key]: value } } };
}
