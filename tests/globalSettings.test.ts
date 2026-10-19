import { defaultGlobalSettings, sanitizeGlobalSettings } from '../src/settings/globalSettings';
import { clearAppStorage } from '../src/settings/useGlobalSettings';

describe('sanitizeGlobalSettings', () => {
  it('returns defaults when input is not an object', () => {
    expect(sanitizeGlobalSettings(null)).toEqual(defaultGlobalSettings);
    expect(sanitizeGlobalSettings('garbage')).toEqual(defaultGlobalSettings);
    expect(sanitizeGlobalSettings(42)).toEqual(defaultGlobalSettings);
  });

  it('keeps valid values and clamps out-of-range numbers', () => {
    expect(sanitizeGlobalSettings({ labelScale: 1.8, rotateSpeed: 2 })).toMatchObject({
      labelScale: 1.8,
      rotateSpeed: 2
    });
    expect(sanitizeGlobalSettings({ labelScale: 99, rotateSpeed: -5 })).toMatchObject({
      labelScale: 2.5,
      rotateSpeed: 0
    });
  });

  it('falls back per-field instead of resetting everything, so old storage missing new fields keeps what it has', () => {
    expect(sanitizeGlobalSettings({ labelScale: 1.4 })).toEqual({
      ...defaultGlobalSettings,
      labelScale: 1.4,
    });
  });
});

describe('sanitizeGlobalSettings — choice fields', () => {
  it('keeps known choices and falls back on unknown ones', () => {
    expect(
      sanitizeGlobalSettings({ timeZone: 'local', units: 'imperial', startScene: 'sun', dataSaver: true }),
    ).toMatchObject({ timeZone: 'local', units: 'imperial', startScene: 'sun', dataSaver: true });
    expect(
      sanitizeGlobalSettings({ timeZone: 'mars', units: 'furlongs', startScene: 'moon', dataSaver: 'yes' }),
    ).toMatchObject({ timeZone: 'utc', units: 'metric', startScene: 'last', dataSaver: false });
  });
});

describe('clearAppStorage', () => {
  it("removes only this app's keys", () => {
    window.localStorage.setItem('space-radar:scene:v1', '{}');
    window.localStorage.setItem('space-radar:kp', '[]');
    window.localStorage.setItem('other-app', 'keep');
    clearAppStorage();
    expect(window.localStorage.getItem('space-radar:scene:v1')).toBeNull();
    expect(window.localStorage.getItem('space-radar:kp')).toBeNull();
    expect(window.localStorage.getItem('other-app')).toBe('keep');
  });
});
