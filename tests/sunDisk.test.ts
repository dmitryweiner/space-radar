import {
  formatSolarLocation,
  parseSolarLocation,
  projectToDisk,
  rotateToTime,
  solarAngularRadiusArcsec,
  solarB0Deg,
  synodicRotationDegPerDay,
} from '../src/astro/sunDisk';

describe('sunDisk', () => {
  it('B0 follows its yearly cycle: ~0 in June/December, ±7.25° in March/September', () => {
    expect(Math.abs(solarB0Deg(new Date('2026-06-06T00:00:00Z')))).toBeLessThan(0.3);
    expect(Math.abs(solarB0Deg(new Date('2026-12-07T00:00:00Z')))).toBeLessThan(0.3);
    expect(solarB0Deg(new Date('2026-09-08T00:00:00Z'))).toBeCloseTo(7.25, 1);
    expect(solarB0Deg(new Date('2026-03-06T00:00:00Z'))).toBeCloseTo(-7.25, 1);
  });

  it('apparent radius is largest at perihelion (January)', () => {
    expect(solarAngularRadiusArcsec(new Date('2026-01-03T00:00:00Z'))).toBeCloseTo(975.5, 0);
    expect(solarAngularRadiusArcsec(new Date('2026-07-05T00:00:00Z'))).toBeCloseTo(943.8, 0);
  });

  it('projects disk centre, limb and far side', () => {
    expect(projectToDisk({ latDeg: 0, lonDeg: 0 }, 0)).toEqual({ x: 0, y: 0, visible: true });
    const west = projectToDisk({ latDeg: 0, lonDeg: 60 }, 0);
    expect(west.x).toBeCloseTo(Math.sin(Math.PI / 3));
    expect(west.y).toBeCloseTo(0);
    expect(projectToDisk({ latDeg: 0, lonDeg: 120 }, 0).visible).toBe(false);
    // With the north pole tipped toward us (B0 > 0) the disk centre point sits below centre.
    expect(projectToDisk({ latDeg: 0, lonDeg: 0 }, 7).y).toBeLessThan(0);
    expect(projectToDisk({ latDeg: 90, lonDeg: 0 }, 7).visible).toBe(true);
  });

  it('rotates features west, faster at the equator', () => {
    expect(synodicRotationDegPerDay(0)).toBeCloseTo(13.73, 1);
    expect(synodicRotationDegPerDay(60)).toBeLessThan(synodicRotationDegPerDay(0));
    const later = rotateToTime({ latDeg: 0, lonDeg: -10 }, 0, 86_400_000);
    expect(later.lonDeg).toBeCloseTo(3.73, 1);
  });

  it('parses and formats NOAA locations (west positive)', () => {
    expect(parseSolarLocation('N06W28')).toEqual({ latDeg: 6, lonDeg: 28 });
    expect(parseSolarLocation('S16E05')).toEqual({ latDeg: -16, lonDeg: -5 });
    expect(parseSolarLocation('S08W0*')).toBeNull();
    expect(formatSolarLocation({ latDeg: -16.2, lonDeg: -5.4 })).toBe('S16E05');
  });
});
