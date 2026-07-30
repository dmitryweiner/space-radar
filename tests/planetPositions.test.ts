import { computePlanetPositions, computePlanetOrbitPath } from '../src/astro/planetPositions';

const FIXED_DATE = new Date('2026-07-30T12:00:00.000Z');

describe('computePlanetPositions', () => {
  it('returns all eight planets', () => {
    const positions = computePlanetPositions(FIXED_DATE);
    expect(positions.map((p) => p.name)).toEqual([
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ]);
  });

  it('matches a reference ecliptic-frame ephemeris run for Earth and Jupiter', () => {
    const positions = computePlanetPositions(FIXED_DATE);
    const earth = positions.find((p) => p.name === 'Earth');
    const jupiter = positions.find((p) => p.name === 'Jupiter');

    expect(earth?.xAu).toBeCloseTo(0.6160125331148958, 9);
    expect(earth?.yAu).toBeCloseTo(-0.8068718392005546, 9);
    expect(earth?.zAu).toBeCloseTo(-8.187625920030861e-7, 9);
    expect(earth?.distanceAu).toBeCloseTo(1.0151421604140904, 9);

    expect(jupiter?.distanceAu).toBeCloseTo(5.286335182257142, 9);
  });

  it('places Earth about 1 AU from the Sun and orders planets by increasing distance', () => {
    const positions = computePlanetPositions(FIXED_DATE);
    const earth = positions.find((p) => p.name === 'Earth');
    expect(earth?.distanceAu).toBeGreaterThan(0.98);
    expect(earth?.distanceAu).toBeLessThan(1.02);

    const distances = positions.map((p) => p.distanceAu);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  it('uses the ecliptic frame, so Earth is (by definition) nearly flat while Mercury shows its real ~7° tilt', () => {
    const positions = computePlanetPositions(FIXED_DATE);
    const earth = positions.find((p) => p.name === 'Earth');
    const mercury = positions.find((p) => p.name === 'Mercury');

    expect(Math.abs(earth?.zAu ?? 1)).toBeLessThan(0.001);
    expect(Math.abs(mercury?.zAu ?? 0)).toBeGreaterThan(0.01);
  });
});

describe('computePlanetOrbitPath', () => {
  it('samples the requested number of points, closing the loop after one orbital period', () => {
    const path = computePlanetOrbitPath('Mercury', FIXED_DATE, 8);
    expect(path).toHaveLength(9);
    expect(path[0].xAu).toBeCloseTo(path[8].xAu, 1);
    expect(path[0].yAu).toBeCloseTo(path[8].yAu, 1);
    expect(path[0].zAu).toBeCloseTo(path[8].zAu, 1);
  });

  it('stays near the planet\'s real orbital radius throughout the path', () => {
    const path = computePlanetOrbitPath('Earth', FIXED_DATE, 12);
    for (const point of path) {
      const distance = Math.hypot(point.xAu, point.yAu, point.zAu);
      expect(distance).toBeGreaterThan(0.98);
      expect(distance).toBeLessThan(1.02);
    }
  });

  it('shows a visibly different orbital plane for Mercury than for Earth', () => {
    const earthPath = computePlanetOrbitPath('Earth', FIXED_DATE, 16);
    const mercuryPath = computePlanetOrbitPath('Mercury', FIXED_DATE, 16);
    const maxAbsZ = (points: { zAu: number }[]) => Math.max(...points.map((p) => Math.abs(p.zAu)));

    expect(maxAbsZ(earthPath)).toBeLessThan(0.001);
    expect(maxAbsZ(mercuryPath)).toBeGreaterThan(0.03);
  });
});
