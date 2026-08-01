import { parseTleText, fetchTleGroup, fetchTleGroups } from '../src/api/celestrak';

const SAMPLE_TLE_TEXT = `ISS (ZARYA)
1 25544U 98067A   26029.51782528  .00016717  00000-0  30171-3 0  9005
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377342295234
NOAA 15
1 25338U 98030A   26029.50000000  .00000023  00000-0  24140-4 0  9992
2 25338  98.7210 100.1234 0010897  90.0000 270.1234 14.25920123456789
`;

describe('parseTleText', () => {
  it('splits the text into name/line1/line2 triplets', () => {
    const records = parseTleText(SAMPLE_TLE_TEXT);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      name: 'ISS (ZARYA)',
      line1: '1 25544U 98067A   26029.51782528  .00016717  00000-0  30171-3 0  9005',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377342295234',
    });
    expect(records[1].name).toBe('NOAA 15');
  });

  it('ignores trailing blank lines', () => {
    const records = parseTleText(`${SAMPLE_TLE_TEXT}\n\n`);
    expect(records).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(parseTleText('')).toEqual([]);
  });
});

describe('fetchTleGroup', () => {
  it('fetches the CelesTrak GP endpoint for the given group and parses the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_TLE_TEXT),
    });
    const records = await fetchTleGroup('stations', fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('GROUP=stations'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('FORMAT=tle'),
    );
    expect(records).toHaveLength(2);
  });

  it('throws when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('') });
    await expect(fetchTleGroup('stations', fetchMock)).rejects.toThrow();
  });
});

const STATIONS_TEXT = `ISS (ZARYA)
1 25544U 98067A   26029.51782528  .00016717  00000-0  30171-3 0  9005
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377342295234
`;

const VISUAL_TEXT = `ISS (ZARYA)
1 25544U 98067A   26029.51782528  .00016717  00000-0  30171-3 0  9005
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377342295234
HST
1 20580U 90037B   26029.50000000  .00000900  00000-0  44000-4 0  9990
2 20580  28.4700 100.0000 0002700  90.0000 270.0000 15.09000000000001
`;

describe('fetchTleGroups', () => {
  it('merges groups and de-duplicates by NORAD id (ISS appears in both)', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(url.includes('visual') ? VISUAL_TEXT : STATIONS_TEXT) }),
    );
    const records = await fetchTleGroups(['stations', 'visual'], fetchMock);
    expect(records.map((r) => r.name).sort()).toEqual(['HST', 'ISS (ZARYA)']);
  });

  it('tolerates a partial failure as long as one group resolves', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.includes('visual')
        ? Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') })
        : Promise.resolve({ ok: true, text: () => Promise.resolve(STATIONS_TEXT) }),
    );
    const records = await fetchTleGroups(['stations', 'visual'], fetchMock);
    expect(records).toHaveLength(1);
  });

  it('throws when every group fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('') });
    await expect(fetchTleGroups(['stations', 'visual'], fetchMock)).rejects.toThrow();
  });
});
