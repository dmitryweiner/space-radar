import { computePlanetPositions } from '../src/astro/planetPositions';

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

  it('matches a reference ephemeris run for Earth and Jupiter', () => {
    const positions = computePlanetPositions(FIXED_DATE);
    const earth = positions.find((p) => p.name === 'Earth');
    const jupiter = positions.find((p) => p.name === 'Jupiter');

    expect(earth?.xAu).toBeCloseTo(0.6107335446866241, 9);
    expect(earth?.yAu).toBeCloseTo(-0.7439810546613048, 9);
    expect(earth?.zAu).toBeCloseTo(-0.32250633102274223, 9);
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
});
