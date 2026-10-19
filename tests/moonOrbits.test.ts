import { MEAN_MOON_ORBITS, meanMoonOffset } from '../src/astro/moonOrbits';
import type { HeliocentricVector } from '../src/astro/planetPositions';

function orbit(name: string) {
  const found = MEAN_MOON_ORBITS.find((o) => o.name === name);
  if (!found) throw new Error(name);
  return found;
}

function angleDeg(a: HeliocentricVector, b: HeliocentricVector): number {
  const dot = a.xAu * b.xAu + a.yAu * b.yAu + a.zAu * b.zAu;
  const len = Math.hypot(a.xAu, a.yAu, a.zAu) * Math.hypot(b.xAu, b.yAu, b.zAu);
  return (Math.acos(Math.min(1, dot / len)) * 180) / Math.PI;
}

// Planet-centred J2000 ecliptic vectors (AU) from JPL Horizons.
const REFERENCE: { name: string; at: string; vector: HeliocentricVector }[] = [
  { name: 'Phobos', at: '2026-01-01T00:00:00Z', vector: { xAu: -1.756858744157232e-5, yAu: -5.903285337698675e-5, zAu: 4.257210683663478e-6 } },
  { name: 'Deimos', at: '2031-06-01T00:00:00Z', vector: { xAu: 6.065606860772598e-5, yAu: 1.431791252197769e-4, zAu: -2.012264002529329e-5 } },
  { name: 'Rhea', at: '2031-06-01T00:00:00Z', vector: { xAu: -1.015431701494795e-3, yAu: 3.022537814403401e-3, zAu: -1.502829776648838e-3 } },
  { name: 'Titan', at: '2031-06-01T00:00:00Z', vector: { xAu: 7.129994532655675e-3, yAu: -3.351250153527784e-3, zAu: 1.014583794982385e-3 } },
];

describe('meanMoonOffset', () => {
  it.each(REFERENCE)('points $name within a few degrees of Horizons at $at', ({ name, at, vector }) => {
    const offset = meanMoonOffset(orbit(name), new Date(at));
    expect(angleDeg(offset, vector)).toBeLessThan(4);
  });

  it('keeps each moon at its mean distance, in its orbit plane', () => {
    for (const o of MEAN_MOON_ORBITS) {
      const v = meanMoonOffset(o, new Date('2027-03-15T12:00:00Z'));
      expect(Math.hypot(v.xAu, v.yAu, v.zAu)).toBeCloseTo(o.aAu, 10);
      expect(Math.abs(v.xAu * o.pole.xAu + v.yAu * o.pole.yAu + v.zAu * o.pole.zAu)).toBeLessThan(o.aAu * 1e-5);
    }
  });

  it('lists moons from each planet outward', () => {
    for (const planet of ['Mars', 'Saturn']) {
      const distances = MEAN_MOON_ORBITS.filter((o) => o.planet === planet).map((o) => o.aAu);
      expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    }
  });
});
