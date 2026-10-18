import { computeBodyOrientation } from '../src/astro/bodyOrientation';

const DATE = new Date(Date.UTC(2026, 9, 18, 12, 0));
const RAD = 180 / Math.PI;

function dot(a: { xAu: number; yAu: number; zAu: number }, b: { xAu: number; yAu: number; zAu: number }) {
  return a.xAu * b.xAu + a.yAu * b.yAu + a.zAu * b.zAu;
}

// Tilt of the pole from the ecliptic north pole, in degrees.
function tiltDeg(name: string): number {
  const orientation = computeBodyOrientation(name, DATE);
  if (!orientation) throw new Error(`no orientation for ${name}`);
  return Math.acos(orientation.north.zAu) * RAD;
}

describe('computeBodyOrientation', () => {
  it('tilts each pole by its real obliquity to the ecliptic (roughly — orbits are inclined a few degrees)', () => {
    expect(tiltDeg('Earth')).toBeCloseTo(23.44, 1);
    expect(tiltDeg('Saturn')).toBeGreaterThan(25);
    expect(tiltDeg('Saturn')).toBeLessThan(29);
    // Uranus rolls on its side. IAU "north" is the pole on the ecliptic-north
    // side (so 82°, not the 98° obliquity); its retrograde spin shows up as
    // the meridian turning the other way instead.
    expect(tiltDeg('Uranus')).toBeGreaterThan(80);
    expect(tiltDeg('Uranus')).toBeLessThan(85);
  });

  it('returns unit, perpendicular pole and meridian vectors', () => {
    for (const name of ['Sun', 'Mercury', 'Jupiter', 'Moon']) {
      const orientation = computeBodyOrientation(name, DATE);
      expect(orientation).not.toBeNull();
      if (!orientation) continue;
      expect(dot(orientation.north, orientation.north)).toBeCloseTo(1, 6);
      expect(dot(orientation.meridian, orientation.meridian)).toBeCloseTo(1, 6);
      expect(dot(orientation.north, orientation.meridian)).toBeCloseTo(0, 6);
    }
  });

  it('turns the prime meridian with the body’s spin (Earth: ~one turn per sidereal day)', () => {
    const a = computeBodyOrientation('Earth', DATE);
    const b = computeBodyOrientation('Earth', new Date(DATE.getTime() + 6 * 3600 * 1000));
    if (!a || !b) throw new Error('missing');
    expect(Math.acos(dot(a.meridian, b.meridian)) * RAD).toBeCloseTo(90.25, 0);
  });

  it('has no model for the Galilean moons', () => {
    expect(computeBodyOrientation('Io', DATE)).toBeNull();
  });
});
