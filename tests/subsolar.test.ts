import { sublunarPoint, subsolarPoint } from '../src/astro/subsolar';

describe('subsolarPoint', () => {
  it('sits on the equator at the March equinox', () => {
    // 2026 March equinox: 2026-03-20 14:46 UTC.
    expect(Math.abs(subsolarPoint(new Date('2026-03-20T14:46:00Z')).latitudeDeg)).toBeLessThan(0.05);
  });

  it('sits on the Tropic of Cancer at the June solstice', () => {
    expect(subsolarPoint(new Date('2026-06-21T08:24:00Z')).latitudeDeg).toBeCloseTo(23.44, 1);
  });

  it('is near the Greenwich meridian at 12:00 UTC (within the equation of time)', () => {
    for (const iso of ['2026-02-11T12:00:00Z', '2026-05-14T12:00:00Z', '2026-11-03T12:00:00Z']) {
      expect(Math.abs(subsolarPoint(new Date(iso)).longitudeDeg)).toBeLessThan(4.5);
    }
  });

  it('moves ~15° west per hour', () => {
    const a = subsolarPoint(new Date('2026-10-14T06:00:00Z')).longitudeDeg;
    const b = subsolarPoint(new Date('2026-10-14T07:00:00Z')).longitudeDeg;
    expect(a - b).toBeCloseTo(15, 0);
  });
});

describe('sublunarPoint', () => {
  it('stays within the Moon’s declination range and a valid longitude', () => {
    const point = sublunarPoint(new Date('2026-10-14T00:00:00Z'));
    expect(Math.abs(point.latitudeDeg)).toBeLessThan(29);
    expect(point.longitudeDeg).toBeGreaterThanOrEqual(-180);
    expect(point.longitudeDeg).toBeLessThan(180);
  });
});
