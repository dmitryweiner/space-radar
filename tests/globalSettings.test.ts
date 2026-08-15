import { defaultGlobalSettings, sanitizeGlobalSettings } from '../src/layout/globalSettings';

describe('sanitizeGlobalSettings', () => {
  it('returns defaults when input is not an object', () => {
    expect(sanitizeGlobalSettings(null)).toEqual(defaultGlobalSettings);
    expect(sanitizeGlobalSettings('garbage')).toEqual(defaultGlobalSettings);
    expect(sanitizeGlobalSettings(42)).toEqual(defaultGlobalSettings);
  });

  it('keeps valid values and clamps out-of-range numbers', () => {
    expect(sanitizeGlobalSettings({ labelScale: 1.8, rotateSpeed: 2, density: 'compact' })).toEqual({
      labelScale: 1.8,
      rotateSpeed: 2,
      density: 'compact',
    });
    expect(sanitizeGlobalSettings({ labelScale: 99, rotateSpeed: -5 })).toEqual({
      labelScale: 2.5,
      rotateSpeed: 0,
      density: 'comfortable',
    });
  });

  it('falls back per-field instead of resetting everything, so old storage missing new fields keeps what it has', () => {
    expect(sanitizeGlobalSettings({ labelScale: 1.4 })).toEqual({
      labelScale: 1.4,
      rotateSpeed: 1,
      density: 'comfortable',
    });
  });

  it('rejects an unknown density value', () => {
    expect(sanitizeGlobalSettings({ density: 'spacious' }).density).toBe('comfortable');
  });
});
