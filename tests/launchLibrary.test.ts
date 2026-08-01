import { parseLaunches, fetchUpcomingLaunches } from '../src/api/launchLibrary';

const SAMPLE = {
  count: 366,
  results: [
    {
      id: 'launch-1',
      name: 'Falcon 9 Block 5 | Starlink Group 17-52',
      status: { id: 1, name: 'Go for Launch', abbrev: 'Go' },
      net: '2026-08-01T02:00:00Z',
      lsp_name: 'SpaceX',
      location: 'Vandenberg SFB, CA, USA',
    },
    {
      id: 'launch-2',
      name: 'Mystery Rocket',
      status: null,
      net: '2026-08-02T00:00:00Z',
      lsp_name: null,
      location: null,
    },
  ],
};

describe('parseLaunches', () => {
  it('normalizes list-mode launch records, tolerating missing status/provider/location', () => {
    expect(parseLaunches(SAMPLE)).toEqual([
      {
        id: 'launch-1',
        name: 'Falcon 9 Block 5 | Starlink Group 17-52',
        status: 'Go',
        net: '2026-08-01T02:00:00Z',
        provider: 'SpaceX',
        location: 'Vandenberg SFB, CA, USA',
      },
      {
        id: 'launch-2',
        name: 'Mystery Rocket',
        status: '—',
        net: '2026-08-02T00:00:00Z',
        provider: null,
        location: null,
      },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseLaunches(null)).toEqual([]);
    expect(parseLaunches({ results: 'nope' })).toEqual([]);
  });
});

describe('fetchUpcomingLaunches', () => {
  it('fetches the Launch Library upcoming endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE) });
    const launches = await fetchUpcomingLaunches(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('ll.thespacedevs.com'));
    expect(launches).toHaveLength(2);
  });

  it('throws when the request is not ok (e.g. rate limited)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve(null) });
    await expect(fetchUpcomingLaunches(fetchMock)).rejects.toThrow(/rate limit/i);
  });
});
