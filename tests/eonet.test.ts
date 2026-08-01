import { parseNaturalEvents, fetchNaturalEvents } from '../src/api/eonet';

const SAMPLE = {
  title: 'EONET Events',
  events: [
    {
      id: 'EONET_1',
      title: 'Some Wildfire, Georgia',
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      geometry: [
        { date: '2026-07-28T12:00:00Z', magnitudeValue: 100, magnitudeUnit: 'acres', coordinates: [-81.0, 30.0] },
        { date: '2026-07-30T12:00:00Z', magnitudeValue: 600, magnitudeUnit: 'acres', coordinates: [-81.5, 31.2] },
      ],
    },
    {
      id: 'EONET_2',
      title: 'Some Volcano',
      categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
      geometry: [{ date: '2026-07-31T00:00:00Z', type: 'Polygon', coordinates: [[[10, 20], [11, 21]]] }],
    },
  ],
};

describe('parseNaturalEvents', () => {
  it('normalizes events with latest geometry date and magnitude, sorted most recent first', () => {
    expect(parseNaturalEvents(SAMPLE)).toEqual([
      {
        id: 'EONET_2',
        title: 'Some Volcano',
        category: 'Volcanoes',
        time: '2026-07-31T00:00:00Z',
        magnitude: null,
        latitude: 20,
        longitude: 10,
      },
      {
        id: 'EONET_1',
        title: 'Some Wildfire, Georgia',
        category: 'Wildfires',
        time: '2026-07-30T12:00:00Z',
        magnitude: '600 acres',
        latitude: 31.2,
        longitude: -81.5,
      },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseNaturalEvents(null)).toEqual([]);
    expect(parseNaturalEvents({ events: 'nope' })).toEqual([]);
  });
});

describe('fetchNaturalEvents', () => {
  it('fetches the EONET open-events endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE) });
    const events = await fetchNaturalEvents(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('eonet.gsfc.nasa.gov'));
    expect(events).toHaveLength(2);
  });

  it('throws when the request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(fetchNaturalEvents(fetchMock)).rejects.toThrow();
  });
});
