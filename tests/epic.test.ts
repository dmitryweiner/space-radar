import { parseEpic, epicImageUrl, fetchEpic } from '../src/api/epic';

const SAMPLE = [
  {
    identifier: '20260731002712',
    image: 'epic_1b_20260731002712',
    date: '2026-07-31 00:22:24',
    centroid_coordinates: { lat: 10.656738, lon: -175.473633 },
  },
  {
    identifier: '20260731012712',
    image: 'epic_1b_20260731012712',
    date: '2026-07-31 01:22:24',
    centroid_coordinates: { lat: 8.1, lon: 160.0 },
  },
];

describe('epicImageUrl', () => {
  it('builds the archive path from the image id and date', () => {
    expect(epicImageUrl('epic_1b_20260731002712', '2026-07-31 00:22:24')).toBe(
      'https://epic.gsfc.nasa.gov/archive/natural/2026/07/31/jpg/epic_1b_20260731002712.jpg',
    );
  });
});

describe('parseEpic', () => {
  it('parses frames with image url and centroid', () => {
    const frames = parseEpic(SAMPLE);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toEqual({
      image: 'epic_1b_20260731002712',
      date: '2026-07-31 00:22:24',
      imageUrl: 'https://epic.gsfc.nasa.gov/archive/natural/2026/07/31/jpg/epic_1b_20260731002712.jpg',
      centroidLat: 10.656738,
      centroidLon: -175.473633,
    });
  });

  it('tolerates missing centroid and skips malformed entries', () => {
    const frames = parseEpic([{ image: 'x', date: '2026-01-02 00:00:00' }, { nope: true }, null]);
    expect(frames).toHaveLength(1);
    expect(frames[0].centroidLat).toBeNull();
  });

  it('returns an empty array for non-array input', () => {
    expect(parseEpic(null)).toEqual([]);
    expect(parseEpic({})).toEqual([]);
  });
});

describe('fetchEpic', () => {
  it('fetches the EPIC natural endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE) });
    const frames = await fetchEpic(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('epic.gsfc.nasa.gov/api/natural'));
    expect(frames).toHaveLength(2);
  });

  it('throws when the request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchEpic(fetchMock)).rejects.toThrow();
  });
});
