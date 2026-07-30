import { parseAsteroids, fetchAsteroids } from '../src/api/neows';

const FEED_SAMPLE = {
  near_earth_objects: {
    '2026-07-30': [
      {
        id: '3542519',
        name: '(2010 XC15)',
        is_potentially_hazardous_asteroid: true,
        estimated_diameter: {
          kilometers: { estimated_diameter_min: 0.123, estimated_diameter_max: 0.276 },
        },
        close_approach_data: [
          {
            close_approach_date_full: '2026-Jul-30 08:00',
            relative_velocity: { kilometers_per_hour: '45000.5' },
            miss_distance: { kilometers: '1234567.8' },
          },
        ],
      },
    ],
    '2026-07-31': [
      {
        id: '2000433',
        name: '433 Eros',
        is_potentially_hazardous_asteroid: false,
        estimated_diameter: {
          kilometers: { estimated_diameter_min: 10.4, estimated_diameter_max: 23.3 },
        },
        close_approach_data: [
          {
            close_approach_date_full: '2026-Jul-31 14:30',
            relative_velocity: { kilometers_per_hour: '12000' },
            miss_distance: { kilometers: '98765432.1' },
          },
        ],
      },
    ],
  },
};

describe('parseAsteroids', () => {
  it('flattens the near_earth_objects-by-date map into a normalized list', () => {
    const asteroids = parseAsteroids(FEED_SAMPLE);
    expect(asteroids).toHaveLength(2);
    expect(asteroids[0]).toEqual({
      id: '3542519',
      name: '(2010 XC15)',
      hazardous: true,
      diameterMinKm: 0.123,
      diameterMaxKm: 0.276,
      closeApproachDate: '2026-Jul-30 08:00',
      missDistanceKm: 1234567.8,
      relativeVelocityKmH: 45000.5,
    });
  });

  it('returns an empty array for malformed input', () => {
    expect(parseAsteroids(null)).toEqual([]);
    expect(parseAsteroids({})).toEqual([]);
    expect(parseAsteroids({ near_earth_objects: 'nope' })).toEqual([]);
  });

  it('skips objects with no close_approach_data entries', () => {
    const withEmpty = {
      near_earth_objects: {
        '2026-08-01': [
          {
            id: 'x',
            name: 'X',
            is_potentially_hazardous_asteroid: false,
            estimated_diameter: { kilometers: { estimated_diameter_min: 1, estimated_diameter_max: 2 } },
            close_approach_data: [],
          },
        ],
      },
    };
    expect(parseAsteroids(withEmpty)).toEqual([]);
  });
});

describe('fetchAsteroids', () => {
  it('fetches the NeoWs feed endpoint and parses it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(FEED_SAMPLE) });
    const asteroids = await fetchAsteroids(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/neo/rest/v1/feed'));
    expect(asteroids).toHaveLength(2);
  });

  it('throws when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve(null) });
    await expect(fetchAsteroids(fetchMock)).rejects.toThrow();
  });
});
