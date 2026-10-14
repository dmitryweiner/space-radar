import { changeLayerSetting, defaultSceneState, sanitizeSceneState, sanitizeUiMode, toggleLayer } from '../src/scene/sceneState';

const KNOWN = ['iss', 'quakes', 'fires'];
const DEFAULTS = ['iss', 'quakes'];

describe('sceneState', () => {
  it('defaults to the Earth scene with the default layers', () => {
    expect(defaultSceneState(DEFAULTS)).toEqual({ scene: 'earth', enabledLayers: ['iss', 'quakes'], layerSettings: {}, earthStyle: 'globe' });
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
      layerSettings: { fires: { dayRange: 2, list: ['a'] } },
      earthStyle: 'globe',
    });
    expect(sanitizeSceneState('garbage', KNOWN, DEFAULTS)).toEqual(defaultSceneState(DEFAULTS));
    expect(sanitizeSceneState({ scene: 'mars' }, KNOWN, DEFAULTS).enabledLayers).toEqual(DEFAULTS);
  });

  it('toggles layers and merges per-layer settings', () => {
    const base = defaultSceneState(DEFAULTS);
    expect(toggleLayer(base, 'iss').enabledLayers).toEqual(['quakes']);
    expect(toggleLayer(base, 'fires').enabledLayers).toEqual(['iss', 'quakes', 'fires']);
    const changed = changeLayerSetting(changeLayerSetting(base, 'fires', 'dayRange', 3), 'fires', 'labelCount', 0);
    expect(changed.layerSettings.fires).toEqual({ dayRange: 3, labelCount: 0 });
  });

  it('makes the Scene the default UI mode', () => {
    expect(sanitizeUiMode(null)).toBe('scene');
    expect(sanitizeUiMode('weird')).toBe('scene');
    expect(sanitizeUiMode('dashboard')).toBe('dashboard');
  });
});
