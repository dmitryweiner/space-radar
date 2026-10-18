import { positionAt, trailUntil } from '../src/layers/spacecraftLayer';

const DAY = 24 * 3600 * 1000;
const SAMPLES = [
  { ms: 0, xAu: 0, yAu: 0, zAu: 0 },
  { ms: DAY, xAu: 1, yAu: 2, zAu: 0 },
  { ms: 2 * DAY, xAu: 2, yAu: 2, zAu: 4 },
];

describe('spacecraft track helpers', () => {
  it('interpolates linearly between samples and is null outside the track', () => {
    expect(positionAt(SAMPLES, DAY / 2)).toEqual({ xAu: 0.5, yAu: 1, zAu: 0 });
    expect(positionAt(SAMPLES, 2 * DAY)).toEqual({ xAu: 2, yAu: 2, zAu: 4 });
    expect(positionAt(SAMPLES, -1)).toBeNull();
    expect(positionAt(SAMPLES, 3 * DAY)).toBeNull();
    expect(positionAt([], 0)).toBeNull();
  });

  it('builds a trail of past samples ending at the interpolated head', () => {
    const trail = trailUntil(SAMPLES, 1.5 * DAY, DAY);
    expect(trail).toEqual([
      { ms: DAY, xAu: 1, yAu: 2, zAu: 0 },
      { xAu: 1.5, yAu: 2, zAu: 2 },
    ]);
    expect(trailUntil(SAMPLES, 5 * DAY, DAY)).toEqual([]);
  });
});
