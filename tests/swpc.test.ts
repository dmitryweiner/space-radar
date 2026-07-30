import {
  parseKpIndex,
  parseSolarWind,
  fetchKpIndex,
  fetchSolarWind,
  auroraForecastImageUrl,
} from '../src/api/swpc';

const KP_SAMPLE = [
  { time_tag: '2026-07-29T00:00:00', Kp: 2.0, a_running: 7, station_count: 11 },
  { time_tag: '2026-07-29T03:00:00', Kp: 3.33, a_running: 9, station_count: 12 },
];

const WIND_SAMPLE = [
  ['time_tag', 'speed', 'density', 'temperature', 'bx', 'by', 'bz', 'bt'],
  ['2026-07-29T00:00:00Z', 402.3, 4.51, 103000.0, -2.6, -0.5, -0.5, 2.8],
  ['2026-07-29T00:05:00Z', 399.9, null, 101500.0, -2.5, -0.4, -0.6, 2.7],
];

describe('parseKpIndex', () => {
  it('converts the array-of-objects response into typed points', () => {
    const points = parseKpIndex(KP_SAMPLE);
    expect(points).toEqual([
      { time: '2026-07-29T00:00:00', kp: 2.0 },
      { time: '2026-07-29T03:00:00', kp: 3.33 },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseKpIndex(null)).toEqual([]);
    expect(parseKpIndex('nope')).toEqual([]);
    expect(parseKpIndex([{ time_tag: '2026-07-29T00:00:00' }])).toEqual([]);
  });
});

describe('parseSolarWind', () => {
  it('reads columns by header name and tolerates null cells', () => {
    const points = parseSolarWind(WIND_SAMPLE);
    expect(points).toEqual([
      { time: '2026-07-29T00:00:00Z', density: 4.51, speed: 402.3, temperature: 103000 },
      { time: '2026-07-29T00:05:00Z', density: null, speed: 399.9, temperature: 101500 },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseSolarWind(undefined)).toEqual([]);
    expect(parseSolarWind([['time_tag']])).toEqual([]);
  });
});

describe('fetchKpIndex / fetchSolarWind', () => {
  it('fetches the NOAA SWPC endpoints and parses the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(KP_SAMPLE) });
    const points = await fetchKpIndex(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('noaa-planetary-k-index.json'));
    expect(points).toHaveLength(2);
  });

  it('fetches the propagated solar wind endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(WIND_SAMPLE) });
    const points = await fetchSolarWind(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('propagated-solar-wind'));
    expect(points).toHaveLength(2);
  });

  it('throws when the solar wind response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchSolarWind(fetchMock)).rejects.toThrow();
  });
});

describe('auroraForecastImageUrl', () => {
  it('returns a stable NOAA OVATION image URL', () => {
    expect(auroraForecastImageUrl()).toMatch(/^https:\/\/services\.swpc\.noaa\.gov\//);
  });
});
