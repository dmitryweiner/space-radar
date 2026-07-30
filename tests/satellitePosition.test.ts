import { computeSatellitePosition } from '../src/astro/satellitePosition';
import type { TleRecord } from '../src/api/types';

const ISS_TLE: TleRecord = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   26210.89416807  .00008676  00000+0  16394-3 0  9996',
  line2: '2 25544  51.6319  88.7482 0007060 351.9810   8.1065 15.49254247578377',
};

const FIXED_DATE = new Date('2026-07-30T12:00:00.000Z');

describe('computeSatellitePosition', () => {
  it('propagates a real TLE to geodetic coordinates matching a reference SGP4 run', () => {
    const position = computeSatellitePosition(ISS_TLE, FIXED_DATE);
    expect(position).not.toBeNull();
    expect(position?.latitudeDeg).toBeCloseTo(29.453758656093942, 6);
    expect(position?.longitudeDeg).toBeCloseTo(111.21211629930946, 6);
    expect(position?.altitudeKm).toBeCloseTo(424.3462901476487, 6);
  });

  it('stays within the physically possible bounds for ISS orbital inclination', () => {
    const position = computeSatellitePosition(ISS_TLE, FIXED_DATE);
    expect(Math.abs(position?.latitudeDeg ?? 0)).toBeLessThanOrEqual(51.6416);
    expect(position?.altitudeKm ?? 0).toBeGreaterThan(300);
    expect(position?.altitudeKm ?? 0).toBeLessThan(500);
  });

  it('returns null for a malformed TLE instead of NaN coordinates', () => {
    const position = computeSatellitePosition({ name: 'garbage', line1: 'garbage', line2: 'garbage' }, FIXED_DATE);
    expect(position).toBeNull();
  });
});
