import {
  parseKpIndex,
  parseSolarWind,
  parseGoesFlares,
  parseObservedSolarCycle,
  parsePredictedSolarCycle,
  parseAurora,
  fetchKpIndex,
  fetchSolarWind,
  fetchGoesFlares,
  fetchSolarCycle,
  fetchAurora,
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

const GOES_FLARES_SAMPLE = [
  {
    time_tag: '2026-07-31T11:43:00Z',
    begin_time: '2026-07-31T11:43:00Z',
    begin_class: 'C2.1',
    max_time: '2026-07-31T11:47:00Z',
    max_class: 'C3.9',
    end_time: '2026-07-31T11:56:00Z',
    satellite: 18,
  },
];

describe('parseGoesFlares', () => {
  it('converts GOES X-ray flare events into flare events', () => {
    expect(parseGoesFlares(GOES_FLARES_SAMPLE)).toEqual([
      {
        kind: 'flare',
        id: 'goes18-2026-07-31T11:43:00Z',
        time: '2026-07-31T11:43:00Z',
        classType: 'C3.9',
        sourceLocation: null,
      },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseGoesFlares(null)).toEqual([]);
    expect(parseGoesFlares([{ begin_class: 'C1.0' }])).toEqual([]);
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

  it('fetches the GOES flares endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(GOES_FLARES_SAMPLE) });
    const events = await fetchGoesFlares(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('xray-flares-7-day.json'));
    expect(events).toHaveLength(1);
  });

  it('throws when the solar wind response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchSolarWind(fetchMock)).rejects.toThrow();
  });
});

const OBSERVED_CYCLE_SAMPLE = [
  { 'time-tag': '2026-06', ssn: 90.1, smoothed_ssn: 88.4, 'f10.7': 150.2 },
  { 'time-tag': '2026-07', ssn: 78.1, smoothed_ssn: -1, 'f10.7': 136.01 },
];

const PREDICTED_CYCLE_SAMPLE = [
  { 'time-tag': '2026-08', predicted_ssn: 101.4, 'predicted_f10.7': 139.2 },
  { 'time-tag': '2026-09', predicted_ssn: -1, 'predicted_f10.7': -1 },
];

describe('parseObservedSolarCycle', () => {
  it('reads bracket-keyed fields and maps -1 to null', () => {
    expect(parseObservedSolarCycle(OBSERVED_CYCLE_SAMPLE)).toEqual([
      { time: '2026-06', ssn: 90.1, smoothedSsn: 88.4, f107: 150.2 },
      { time: '2026-07', ssn: 78.1, smoothedSsn: null, f107: 136.01 },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseObservedSolarCycle(null)).toEqual([]);
    expect(parseObservedSolarCycle([{ ssn: 1 }])).toEqual([]);
  });
});

describe('parsePredictedSolarCycle', () => {
  it('reads predicted fields and maps -1 to null', () => {
    expect(parsePredictedSolarCycle(PREDICTED_CYCLE_SAMPLE)).toEqual([
      { time: '2026-08', predictedSsn: 101.4, predictedF107: 139.2 },
      { time: '2026-09', predictedSsn: null, predictedF107: null },
    ]);
  });
});

describe('fetchSolarCycle', () => {
  it('fetches both series and tolerates a failing prediction feed', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      url.includes('predicted')
        ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve(null) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(OBSERVED_CYCLE_SAMPLE) }),
    );
    const data = await fetchSolarCycle(fetchMock);
    expect(data.observed).toHaveLength(2);
    expect(data.predicted).toEqual([]);
  });

  it('throws when the observed feed fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchSolarCycle(fetchMock)).rejects.toThrow();
  });
});

const AURORA_SAMPLE = {
  'Observation Time': '2026-08-03T05:46:00Z',
  'Forecast Time': '2026-08-03T06:57:00Z',
  coordinates: [
    [0, -90, 3],
    [0, -89, 0],
    [120, 65, 40],
  ],
};

describe('parseAurora', () => {
  it('keeps non-zero cells and normalises probability to 0..1', () => {
    expect(parseAurora(AURORA_SAMPLE)).toEqual([
      { latitude: -90, longitude: 0, probability: 0.03 },
      { latitude: 65, longitude: 120, probability: 0.4 },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseAurora(null)).toEqual([]);
    expect(parseAurora({ coordinates: [[1, 2]] })).toEqual([]);
  });
});

describe('fetchAurora', () => {
  it('fetches the OVATION endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(AURORA_SAMPLE) });
    const samples = await fetchAurora(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('ovation_aurora_latest.json'));
    expect(samples).toHaveLength(2);
  });
});

describe('auroraForecastImageUrl', () => {
  it('returns a stable NOAA OVATION image URL', () => {
    expect(auroraForecastImageUrl()).toMatch(/^https:\/\/services\.swpc\.noaa\.gov\//);
  });
});
