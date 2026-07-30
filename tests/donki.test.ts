import { parseFlares, parseCmes, fetchSpaceWeatherEvents } from '../src/api/donki';

const FLR_SAMPLE = [
  {
    flrID: '2026-07-28T10:12:00-FLR-001',
    beginTime: '2026-07-28T10:12Z',
    peakTime: '2026-07-28T10:20Z',
    endTime: '2026-07-28T10:30Z',
    classType: 'M1.2',
    sourceLocation: 'N15W20',
  },
];

const CME_SAMPLE = [
  {
    activityID: '2026-07-28T12:00:00-CME-001',
    startTime: '2026-07-28T12:00Z',
    sourceLocation: 'N10W12',
    note: 'Halo CME',
  },
  {
    activityID: '2026-07-27T08:00:00-CME-002',
    startTime: '2026-07-27T08:00Z',
    sourceLocation: null,
    note: '',
  },
];

describe('parseFlares', () => {
  it('normalizes DONKI FLR records', () => {
    expect(parseFlares(FLR_SAMPLE)).toEqual([
      { kind: 'flare', id: '2026-07-28T10:12:00-FLR-001', time: '2026-07-28T10:12Z', classType: 'M1.2', sourceLocation: 'N15W20' },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseFlares(null)).toEqual([]);
    expect(parseFlares('nope')).toEqual([]);
  });
});

describe('parseCmes', () => {
  it('normalizes DONKI CME records, tolerating a null sourceLocation', () => {
    expect(parseCmes(CME_SAMPLE)).toEqual([
      { kind: 'cme', id: '2026-07-28T12:00:00-CME-001', time: '2026-07-28T12:00Z', classType: null, sourceLocation: 'N10W12' },
      { kind: 'cme', id: '2026-07-27T08:00:00-CME-002', time: '2026-07-27T08:00Z', classType: null, sourceLocation: null },
    ]);
  });
});

describe('fetchSpaceWeatherEvents', () => {
  it('fetches FLR and CME feeds and merges them sorted by time, most recent first', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/DONKI/FLR')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FLR_SAMPLE) });
      }
      if (url.includes('/DONKI/CME')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(CME_SAMPLE) });
      }
      throw new Error(`unexpected url ${url}`);
    });
    const events = await fetchSpaceWeatherEvents(fetchMock);
    expect(events.map((e) => e.id)).toEqual([
      '2026-07-28T12:00:00-CME-001',
      '2026-07-28T10:12:00-FLR-001',
      '2026-07-27T08:00:00-CME-002',
    ]);
  });

  it('throws when a feed request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(fetchSpaceWeatherEvents(fetchMock)).rejects.toThrow();
  });
});
