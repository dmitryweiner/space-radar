import { formatUtcTimestamp } from '../src/cards/formatTimestamp';

describe('formatUtcTimestamp', () => {
  it('formats a NOAA-style timestamp without a Z suffix', () => {
    expect(formatUtcTimestamp('2026-07-29T03:00:00')).toBe('2026-07-29 03:00 UTC');
  });

  it('formats a timestamp with a Z suffix', () => {
    expect(formatUtcTimestamp('2026-07-29T00:05:00Z')).toBe('2026-07-29 00:05 UTC');
  });

  it('returns the original string unchanged if it does not match the expected shape', () => {
    expect(formatUtcTimestamp('not a date')).toBe('not a date');
  });
});
