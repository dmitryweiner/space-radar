import { flareStrength, groupFlares } from '../src/layers/sunFlaresLayer';
import { classFlux, fluxClass } from '../src/scene/XrayTimeline';
import type { SolarFlare, SolarRegion } from '../src/api/types';

const REGION: SolarRegion = {
  region: 4551,
  observedDate: '2026-10-19',
  latDeg: -16,
  lonDeg: 60,
  area: 350,
  spotClass: 'Eki',
  magClass: 'BG',
  spots: 12,
  flares: { c: 1, m: 0, x: 0 },
  probability: { c: 40, m: 10, x: 1 },
};

function flare(id: string, classType: string, region: number | null, location: string | null = null): SolarFlare {
  return { id, begin: '2026-10-19T01:00:00Z', peak: '2026-10-19T01:05:00Z', end: null, classType, region, location };
}

describe('sun flares', () => {
  it('orders GOES classes', () => {
    expect(flareStrength('M1.2')).toBeGreaterThan(flareStrength('C9.9'));
    expect(flareStrength('X1')).toBeGreaterThan(flareStrength('M9.9'));
    expect(flareStrength('C2.1')).toBeGreaterThan(flareStrength('C1.0'));
  });

  it('groups by region (strongest first), falls back to the optical location, counts the rest', () => {
    const now = Date.parse('2026-10-20T00:00:00Z'); // the report's epoch (observed date + 1 day)
    const { groups, unplaced } = groupFlares(
      [flare('a', 'C1.0', 4551), flare('b', 'M1.4', 4551), flare('c', 'C2.0', 4999, 'N10E20'), flare('d', 'C3.0', 4999)],
      [REGION],
      now,
    );
    expect(unplaced).toBe(1);
    expect(groups.map((g) => g.key)).toEqual(['r4551', 'r4999']);
    expect(groups[0].flares.map((f) => f.classType)).toEqual(['M1.4', 'C1.0']);
    expect(groups[0].position).toEqual({ latDeg: -16, lonDeg: 60 });
    expect(groups[1].position.latDeg).toBe(10);
  });

  it('converts between flux and class', () => {
    expect(fluxClass(2.07e-6)).toBe('C2.1');
    expect(fluxClass(1.4e-5)).toBe('M1.4');
    expect(fluxClass(3e-9)).toBe('A0.3');
    expect(classFlux('M1.4')).toBeCloseTo(1.4e-5);
  });
});
