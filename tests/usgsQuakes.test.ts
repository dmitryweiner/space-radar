import { parseQuakes, fetchQuakes, quakeFeedUrl } from '../src/api/usgsQuakes';

function feature(id: string, mag: number, lon: number, lat: number, depth = 10) {
  return {
    type: 'Feature',
    id,
    properties: { mag, place: `near ${id}`, time: 1785733280034, url: `https://x/${id}` },
    geometry: { type: 'Point', coordinates: [lon, lat, depth] },
  };
}

const COLLECTION = {
  type: 'FeatureCollection',
  features: [feature('a', 4.5, -70, 19), feature('b', 5.2, 140, -6)],
};

describe('parseQuakes', () => {
  it('reads magnitude, place, and lon/lat/depth', () => {
    const quakes = parseQuakes(COLLECTION);
    expect(quakes).toHaveLength(2);
    expect(quakes[0]).toEqual({
      id: 'a',
      magnitude: 4.5,
      place: 'near a',
      time: 1785733280034,
      latitude: 19,
      longitude: -70,
      depthKm: 10,
      url: 'https://x/a',
    });
  });

  it('skips malformed features and non-collections', () => {
    expect(parseQuakes(null)).toEqual([]);
    expect(parseQuakes({ features: [{ id: 'x' }, null] })).toEqual([]);
  });
});

describe('quakeFeedUrl', () => {
  it('builds the summary feed URL', () => {
    expect(quakeFeedUrl('2.5_day')).toBe(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    );
  });
});

describe('fetchQuakes', () => {
  it('merges selected feeds and dedups by id, newest first', async () => {
    const dayFeed = { type: 'FeatureCollection', features: [feature('a', 4.5, -70, 19)] };
    const weekFeed = {
      type: 'FeatureCollection',
      features: [
        { ...feature('a', 4.5, -70, 19), properties: { mag: 4.5, place: 'near a', time: 1, url: '' } },
        feature('c', 6.1, 10, 40),
      ],
    };
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes('week') ? weekFeed : dayFeed) }),
    );
    const quakes = await fetchQuakes(['2.5_day', '4.5_week'], fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 'a' appears in both feeds but only once; day feed wins by Map insertion.
    expect(quakes.map((q) => q.id).sort()).toEqual(['a', 'c']);
  });

  it('tolerates one failing feed', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url.includes('week')
        ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve(null) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(COLLECTION) }),
    );
    const quakes = await fetchQuakes(['2.5_day', '4.5_week'], fetchMock);
    expect(quakes).toHaveLength(2);
  });

  it('throws when every feed fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchQuakes(['2.5_day'], fetchMock)).rejects.toThrow(/unavailable/i);
  });

  it('falls back to the default feed when selection is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(COLLECTION) });
    await fetchQuakes([], fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('2.5_day'));
  });
});
