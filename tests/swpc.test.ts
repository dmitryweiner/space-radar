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
  parseSolarRegions,
  parseFlareEvents,
  parseXrayFlux,
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

describe('parseSolarRegions', () => {
  const base = {
    region: 4557,
    latitude: 6,
    longitude: -28,
    location: 'N06W28',
    area: 140,
    spot_class: 'Eai',
    number_spots: 22,
    mag_class: 'B',
    c_xray_events: 1,
    m_xray_events: 0,
    x_xray_events: 0,
    c_flare_probability: 35,
    m_flare_probability: 5,
    x_flare_probability: 1,
  };

  it('keeps only the newest report day and flips longitude to west-positive', () => {
    const regions = parseSolarRegions([
      { ...base, observed_date: '2026-10-18', region: 4500 },
      { ...base, observed_date: '2026-10-19' },
      { ...base, observed_date: '2026-10-19', region: 4560, longitude: 12, area: null, spot_class: null, number_spots: null },
    ]);
    expect(regions).toEqual([
      {
        region: 4557,
        observedDate: '2026-10-19',
        latDeg: 6,
        lonDeg: 28,
        area: 140,
        spotClass: 'Eai',
        magClass: 'B',
        spots: 22,
        flares: { c: 1, m: 0, x: 0 },
        probability: { c: 35, m: 5, x: 1 },
      },
      expect.objectContaining({ region: 4560, lonDeg: -12, area: null, spotClass: null }),
    ]);
    expect(parseSolarRegions('nope')).toEqual([]);
  });
});

describe('parseFlareEvents', () => {
  it('merges per-satellite duplicates and attaches optical locations', () => {
    const flares = parseFlareEvents([
      { type: 'XRA', begin_datetime: '2026-10-19T02:06:00', max_datetime: '2026-10-19T02:11:00', end_datetime: '2026-10-19T02:17:00', particulars1: 'C1.0', region: 4559 },
      { type: 'XRA', begin_datetime: '2026-10-19T02:07:00', max_datetime: '2026-10-19T02:11:00', end_datetime: '2026-10-19T02:17:00', particulars1: 'C1.1', region: 4559 },
      { type: 'FLA', begin_datetime: '2026-10-19T02:05:00', end_datetime: '2026-10-19T02:20:00', location: 'S20W35', region: 4559 },
      { type: 'XRA', begin_datetime: '2026-10-19T05:00:00', particulars1: 'B9.2', region: null },
      { type: 'RBR', begin_datetime: '2026-10-19T05:00:00', particulars1: '245' },
    ]);
    expect(flares).toEqual([
      { id: 'xra-2026-10-19T05:00:00Z-B9.2', begin: '2026-10-19T05:00:00Z', peak: null, end: null, classType: 'B9.2', region: null, location: null },
      {
        id: 'xra-2026-10-19T02:06:00Z-C1.0',
        begin: '2026-10-19T02:06:00Z',
        peak: '2026-10-19T02:11:00Z',
        end: '2026-10-19T02:17:00Z',
        classType: 'C1.0',
        region: 4559,
        location: 'S20W35',
      },
    ]);
  });
});

describe('parseXrayFlux', () => {
  it('keeps the long channel with positive flux, sorted', () => {
    expect(
      parseXrayFlux([
        { time_tag: '2026-10-19T07:17:00Z', energy: '0.1-0.8nm', flux: 2e-6 },
        { time_tag: '2026-10-19T07:16:00Z', energy: '0.1-0.8nm', flux: 1e-6 },
        { time_tag: '2026-10-19T07:16:00Z', energy: '0.05-0.4nm', flux: 1e-8 },
        { time_tag: '2026-10-19T07:15:00Z', energy: '0.1-0.8nm', flux: -1 },
      ]),
    ).toEqual([
      { time: '2026-10-19T07:16:00Z', flux: 1e-6 },
      { time: '2026-10-19T07:17:00Z', flux: 2e-6 },
    ]);
  });
});
