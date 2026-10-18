import { computePlanetPositions } from '../src/astro/planetPositions';
import {
  compressForDisplay,
  displayRadiusAu,
  fromMeanAnomaly,
  jdToMs,
  msToJd,
  orbitPath,
  orbitPosition,
  orbitalPeriodDays,
  type OrbitalElements,
} from '../src/astro/kepler';

const radius = (v: { xAu: number; yAu: number; zAu: number }) => Math.hypot(v.xAu, v.yAu, v.zAu);
const K = 0.01720209895;

// J2000 mean elements of the Earth–Moon barycentre (Standish, JPL).
const EARTH = fromMeanAnomaly({
  a: 1.00000261,
  e: 0.01671123,
  i: 0,
  node: 0,
  peri: 102.93768193,
  meanAnomaly: 100.46457166 - 102.93768193,
  epochJd: 2451545.0,
});

const HALLEY: OrbitalElements = { q: 0.575, e: 0.9679, i: 162.19, node: 59.1, peri: 112.24, tpJd: 2446469.97 };

describe('kepler', () => {
  it('converts between ms and Julian Dates', () => {
    expect(msToJd(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 6);
    expect(jdToMs(2451545.0)).toBe(Date.UTC(2000, 0, 1, 12));
  });

  it('puts Earth (from its mean elements) where astronomy-engine does', () => {
    const date = new Date(Date.UTC(2026, 9, 18));
    const engine = computePlanetPositions(date).find((p) => p.name === 'Earth');
    if (!engine) throw new Error('no Earth');
    const ours = orbitPosition(EARTH, msToJd(date.getTime()));
    expect(Math.hypot(ours.xAu - engine.xAu, ours.yAu - engine.yAu, ours.zAu - engine.zAu)).toBeLessThan(0.01);
    expect(orbitalPeriodDays(EARTH)).toBeCloseTo(365.26, 1);
  });

  it('is at perihelion at tp and at aphelion half a period later (Halley)', () => {
    expect(radius(orbitPosition(HALLEY, HALLEY.tpJd))).toBeCloseTo(0.575, 6);
    const period = orbitalPeriodDays(HALLEY) ?? 0;
    // SBDB lists per_y = 75.9 for these osculating elements.
    expect(period / 365.25).toBeCloseTo(75.9, 0);
    const a = HALLEY.q / (1 - HALLEY.e);
    expect(radius(orbitPosition(HALLEY, HALLEY.tpJd + period / 2))).toBeCloseTo(a * (1 + HALLEY.e), 4);
  });

  it('handles hyperbolic orbits symmetrically about perihelion', () => {
    const hyper: OrbitalElements = { q: 1.2, e: 1.0004, i: 40, node: 10, peri: 20, tpJd: 2461000 };
    expect(radius(orbitPosition(hyper, hyper.tpJd))).toBeCloseTo(1.2, 8);
    const before = radius(orbitPosition(hyper, hyper.tpJd - 200));
    const after = radius(orbitPosition(hyper, hyper.tpJd + 200));
    expect(after).toBeCloseTo(before, 8);
    expect(after).toBeGreaterThan(3);
    expect(orbitalPeriodDays(hyper)).toBeNull();
  });

  it('solves the exact parabola (r = 2q at ν = 90°)', () => {
    const q = 0.8;
    const parabola: OrbitalElements = { q, e: 1, i: 0, node: 0, peri: 0, tpJd: 2461000 };
    const dt = (Math.sqrt(2 * q ** 3) / K) * (1 + 1 / 3);
    const at = orbitPosition(parabola, parabola.tpJd + dt);
    expect(radius(at)).toBeCloseTo(2 * q, 6);
    expect(at.xAu).toBeCloseTo(0, 6);
  });

  it('draws a closed loop for a small ellipse and a clipped arc for a long one', () => {
    const small = orbitPath(EARTH, 64);
    expect(small.closed).toBe(true);
    expect(small.points).toHaveLength(64);
    const long = orbitPath(HALLEY, 64, 20);
    expect(long.closed).toBe(false);
    expect(Math.max(...long.points.map(radius))).toBeLessThanOrEqual(20 + 1e-9);
    expect(Math.min(...long.points.map(radius))).toBeCloseTo(0.575, 2);
  });

  it('leaves the planetary region exact and compresses the far outer system', () => {
    expect(displayRadiusAu(30)).toBe(30);
    expect(displayRadiusAu(170)).toBeGreaterThan(55);
    expect(displayRadiusAu(170)).toBeLessThan(65);
    const far = compressForDisplay({ xAu: 0, yAu: 170, zAu: 0 });
    expect(far.yAu).toBeCloseTo(displayRadiusAu(170), 9);
  });
});
