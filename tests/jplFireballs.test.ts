import { fetchFireballs, parseFireballs } from '../src/api/jplFireballs';

// Trimmed from the live API (2026-10-14).
const LIVE = {
  signature: { source: 'NASA/JPL Fireball Data API', version: '1.2' },
  count: '2',
  fields: ['date', 'energy', 'impact-e', 'lat', 'lat-dir', 'lon', 'lon-dir', 'alt', 'vel'],
  data: [
    ['2026-10-04 03:14:45', '5.4', '0.18', '41.8', 'S', '173.1', 'W', '26.9', '13.8'],
    ['2026-09-11 01:12:11', '24.6', '0.67', '54.4', 'N', '100.1', 'E', '38.0', null],
    ['bad'],
  ],
};

describe('parseFireballs', () => {
  it('signs lat/lon from the direction columns and reads energy/alt/vel', () => {
    expect(parseFireballs(LIVE)).toEqual([
      { date: '2026-10-04 03:14:45', latitude: -41.8, longitude: -173.1, impactEnergyKt: 0.18, altitudeKm: 26.9, velocityKmS: 13.8 },
      { date: '2026-09-11 01:12:11', latitude: 54.4, longitude: 100.1, impactEnergyKt: 0.67, altitudeKm: 38, velocityKmS: null },
    ]);
  });

  it('returns [] for unexpected shapes', () => {
    expect(parseFireballs({ count: 0 })).toEqual([]);
  });
});

describe('fetchFireballs', () => {
  it('requests located events since the date through the proxy', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => LIVE }));
    const result = await fetchFireballs('2025-10-14', fetchMock);
    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('workers.dev/jpl/fireball.api?date-min=2025-10-14&req-loc=true'));
  });
});
