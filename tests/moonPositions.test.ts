import { computeMoonPositions } from '../src/astro/moonPositions';

describe('computeMoonPositions', () => {
  const moons = computeMoonPositions(new Date('2026-08-02T00:00:00Z'));

  it("includes Earth's Moon and Jupiter's four Galilean moons", () => {
    expect(moons.map((m) => m.name)).toEqual(['Moon', 'Io', 'Europa', 'Ganymede', 'Callisto']);
    expect(moons.find((m) => m.name === 'Moon')?.planet).toBe('Earth');
    expect(moons.filter((m) => m.planet === 'Jupiter')).toHaveLength(4);
  });

  it('orders the Galilean moons from the planet outward by real distance', () => {
    const jovian = moons.filter((m) => m.planet === 'Jupiter');
    const distances = jovian.map((m) => Math.hypot(m.offsetAu.xAu, m.offsetAu.yAu, m.offsetAu.zAu));
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
      expect(jovian[i].order).toBe(i);
    }
  });

  it('places the Moon at roughly its real geocentric distance (~0.0026 AU)', () => {
    const moon = moons.find((m) => m.name === 'Moon');
    expect(moon).toBeDefined();
    const offset = moon?.offsetAu ?? { xAu: 0, yAu: 0, zAu: 0 };
    const distance = Math.hypot(offset.xAu, offset.yAu, offset.zAu);
    expect(distance).toBeGreaterThan(0.002);
    expect(distance).toBeLessThan(0.003);
  });
});
