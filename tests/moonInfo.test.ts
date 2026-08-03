import { computeMoonInfo, phaseName } from '../src/astro/moonInfo';

describe('phaseName', () => {
  it('names the principal phases', () => {
    expect(phaseName(0)).toBe('New Moon');
    expect(phaseName(90)).toBe('First Quarter');
    expect(phaseName(180)).toBe('Full Moon');
    expect(phaseName(270)).toBe('Last Quarter');
  });

  it('names the intermediate phases', () => {
    expect(phaseName(45)).toBe('Waxing Crescent');
    expect(phaseName(135)).toBe('Waxing Gibbous');
    expect(phaseName(225)).toBe('Waning Gibbous');
    expect(phaseName(315)).toBe('Waning Crescent');
  });
});

describe('computeMoonInfo', () => {
  const info = computeMoonInfo(new Date('2026-08-03T00:00:00Z'));

  it('reports phase angle, illumination and waxing state', () => {
    expect(info.phaseAngle).toBeGreaterThan(180);
    expect(info.phaseAngle).toBeLessThan(270);
    expect(info.phaseName).toBe('Waning Gibbous');
    expect(info.illumination).toBeGreaterThan(0.5);
    expect(info.illumination).toBeLessThanOrEqual(1);
    expect(info.waxing).toBe(false);
  });

  it('returns a future perigee and apogee with plausible distances', () => {
    expect(info.nextPerigee.kind).toBe('perigee');
    expect(info.nextApogee.kind).toBe('apogee');
    // Perigee ~356–370k km, apogee ~404–406k km.
    expect(info.nextPerigee.distanceKm).toBeLessThan(info.nextApogee.distanceKm);
    expect(info.nextPerigee.distanceKm).toBeGreaterThan(340000);
    expect(info.nextApogee.distanceKm).toBeLessThan(420000);
  });

  it('returns upcoming lunar and solar eclipses as ISO timestamps', () => {
    expect(info.nextLunarEclipse.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(info.nextSolarEclipse.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(info.nextLunarEclipse.date).getTime()).toBeGreaterThan(Date.parse('2026-08-03T00:00:00Z'));
  });
});
