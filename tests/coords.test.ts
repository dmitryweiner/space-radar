import { geodeticToSceneVector, heliocentricToSceneVector } from '../src/astro/coords';

describe('geodeticToSceneVector', () => {
  it('places a point at the equator/prime-meridian on the +x axis', () => {
    const v = geodeticToSceneVector(0, 0, 0, 1, 6371);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(0, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('places the north pole on the +y axis', () => {
    const v = geodeticToSceneVector(90, 0, 0, 1, 6371);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('scales radius outward with altitude', () => {
    const surface = geodeticToSceneVector(0, 0, 0, 1, 6371);
    const surfaceRadius = Math.hypot(surface.x, surface.y, surface.z);
    const aloft = geodeticToSceneVector(0, 0, 6371, 1, 6371);
    const aloftRadius = Math.hypot(aloft.x, aloft.y, aloft.z);
    expect(aloftRadius).toBeCloseTo(surfaceRadius * 2, 6);
  });
});

describe('heliocentricToSceneVector', () => {
  it('scales AU coordinates by the given units-per-AU factor', () => {
    const v = heliocentricToSceneVector(1, 2, 3, 10);
    expect(v).toEqual({ x: 10, y: 30, z: -20 });
  });
});
