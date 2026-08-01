import { describe, expect, it } from 'vitest';
import { buildTimeAxisLabels } from '../src/cards/TimeAxis';

describe('buildTimeAxisLabels', () => {
  it('returns empty for fewer than two points', () => {
    expect(buildTimeAxisLabels([])).toEqual([]);
    expect(buildTimeAxisLabels(['2026-07-31 06:00:00'])).toEqual([]);
  });

  it('spreads labels across the range and repeats the date only when it changes', () => {
    const times = [
      '2026-07-30 18:00:00',
      '2026-07-30 21:00:00',
      '2026-07-31 00:00:00',
      '2026-07-31 03:00:00',
      '2026-07-31 06:00:00',
      '2026-07-31 09:00:00',
      '2026-07-31 12:00:00',
      '2026-07-31 15:00:00',
    ];
    const labels = buildTimeAxisLabels(times, 4);
    expect(labels.map((l) => l.text)).toEqual(['30.07 18:00', '31.07 00:00', '09:00', '15:00']);
    expect(labels[0].position).toBe(0);
    expect(labels[labels.length - 1].position).toBe(1);
  });

  it('centers labels on bars in bar mode', () => {
    const labels = buildTimeAxisLabels(['2026-07-31 00:00:00', '2026-07-31 03:00:00'], 2, 'bar');
    expect(labels.map((l) => l.position)).toEqual([0.25, 0.75]);
  });

  it('handles ISO T-separated timestamps', () => {
    const labels = buildTimeAxisLabels(['2026-07-31T00:00:00Z', '2026-07-31T03:00:00Z'], 2);
    expect(labels.map((l) => l.text)).toEqual(['31.07 00:00', '03:00']);
  });
});
