import { compressDistance, compressedSceneVector, flybyAxes, flybyOffsetKm, MOON_DISTANCE_KM } from '../src/astro/flyby';

const approach = { id: '3542519', closeApproachMs: Date.UTC(2026, 9, 14), missDistanceKm: 1_000_000, speedKmS: 10 };

describe('flyby geometry', () => {
  it('passes Earth at exactly the miss distance at the close-approach time', () => {
    const at = flybyOffsetKm(approach, approach.closeApproachMs);
    expect(Math.hypot(at.x, at.y, at.z)).toBeCloseTo(1_000_000, 3);
  });

  it('is farther before and after, symmetric, and moves at the given speed', () => {
    const hour = 3600 * 1000;
    const before = flybyOffsetKm(approach, approach.closeApproachMs - hour);
    const after = flybyOffsetKm(approach, approach.closeApproachMs + hour);
    const dist = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
    expect(dist(before)).toBeGreaterThan(1_000_000);
    expect(dist(before)).toBeCloseTo(dist(after), 3);
    expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeCloseTo(10 * 7200, 3);
  });

  it('derives a stable, orthonormal frame per id', () => {
    const { n, u } = flybyAxes('abc');
    expect(flybyAxes('abc')).toEqual({ n, u });
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 9);
    expect(Math.hypot(u.x, u.y, u.z)).toBeCloseTo(1, 9);
    expect(n.x * u.x + n.y * u.y + n.z * u.z).toBeCloseTo(0, 9);
    expect(flybyAxes('xyz').n).not.toEqual(n);
  });

  it('log-compresses distance: surface → globe radius, monotonic, Moon in between', () => {
    expect(compressDistance(6371, 2)).toBeCloseTo(2, 9);
    expect(compressDistance(100, 2)).toBeCloseTo(2, 9);
    const moon = compressDistance(MOON_DISTANCE_KM, 2);
    expect(moon).toBeGreaterThan(4);
    expect(moon).toBeLessThan(compressDistance(10 * MOON_DISTANCE_KM, 2));
    const v = compressedSceneVector({ x: MOON_DISTANCE_KM, y: 0, z: 0 }, 2);
    expect(v.x).toBeCloseTo(moon, 9);
  });
});

describe('dedupeFlybys', () => {
  it('keeps one record per designation and pass, preferring the numbered one', async () => {
    const { dedupeFlybys } = await import('../src/layers/neoFlybyLayer');
    const t = Date.UTC(2026, 9, 15, 12);
    const result = dedupeFlybys([
      { closeApproachMs: t, asteroid: { name: '(2018 EH4)' } },
      { closeApproachMs: t + 60_000, asteroid: { name: '678976 (2018 EH4)' } },
      { closeApproachMs: t, asteroid: { name: '(2020 QG3)' } },
    ]);
    expect(result.map((f) => f.asteroid.name)).toEqual(['678976 (2018 EH4)', '(2020 QG3)']);
  });
});
