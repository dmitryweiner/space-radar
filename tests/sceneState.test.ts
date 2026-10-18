import { changeLayerSetting, defaultSceneState, sanitizeSceneState, toggleLayer, toggleSolarLayer } from '../src/scene/sceneState';

const KNOWN = ['iss', 'quakes', 'fires'];
const DEFAULTS = ['iss', 'quakes'];

describe('sceneState', () => {
  it('defaults to the Earth scene with the default layers', () => {
    expect(defaultSceneState(DEFAULTS)).toEqual({
      scene: 'earth',
      enabledLayers: ['iss', 'quakes'],
      solarLayers: [],
      layerSettings: {},
      earthStyle: 'globe',
    });
  });

  it('sanitizes field by field, dropping unknown layers and bad values', () => {
    const state = sanitizeSceneState(
      {
        scene: 'solar-system',
        enabledLayers: ['fires', 'gone', 3, 'fires'],
        layerSettings: { fires: { dayRange: 2, bad: { nested: true }, list: ['a'] }, gone: { x: 1 } },
        earthStyle: 'hologram',
      },
      KNOWN,
      DEFAULTS,
    );
    expect(state).toEqual({
      scene: 'solar-system',
      enabledLayers: ['fires'],
      solarLayers: [],
      layerSettings: { fires: { dayRange: 2, list: ['a'] } },
      earthStyle: 'globe',
    });
    expect(sanitizeSceneState('garbage', KNOWN, DEFAULTS)).toEqual(defaultSceneState(DEFAULTS));
    expect(sanitizeSceneState({ scene: 'mars' }, KNOWN, DEFAULTS).enabledLayers).toEqual(DEFAULTS);
  });

  it('keeps Solar System layers separately, defaulting them on for older storage', () => {
    const SOLAR = ['spacecraft', 'comets'];
    expect(sanitizeSceneState({ enabledLayers: ['iss'] }, KNOWN, DEFAULTS, SOLAR, SOLAR).solarLayers).toEqual(SOLAR);
    const state = sanitizeSceneState(
      { solarLayers: ['comets', 'iss'], layerSettings: { comets: { maxActive: 5 } } },
      KNOWN,
      DEFAULTS,
      SOLAR,
      SOLAR,
    );
    expect(state.solarLayers).toEqual(['comets']);
    expect(state.layerSettings.comets).toEqual({ maxActive: 5 });
    expect(toggleSolarLayer(state, 'spacecraft').solarLayers).toEqual(['comets', 'spacecraft']);
    expect(toggleSolarLayer(state, 'comets').solarLayers).toEqual([]);
  });

  it('toggles layers and merges per-layer settings', () => {
    const base = defaultSceneState(DEFAULTS);
    expect(toggleLayer(base, 'iss').enabledLayers).toEqual(['quakes']);
    expect(toggleLayer(base, 'fires').enabledLayers).toEqual(['iss', 'quakes', 'fires']);
    const changed = changeLayerSetting(changeLayerSetting(base, 'fires', 'dayRange', 3), 'fires', 'labelCount', 0);
    expect(changed.layerSettings.fires).toEqual({ dayRange: 3, labelCount: 0 });
  });
});
