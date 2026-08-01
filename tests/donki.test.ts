import { parseCmes, fetchCmeEvents } from '../src/api/donki';

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

describe('parseCmes', () => {
  it('normalizes DONKI CME records, tolerating a null sourceLocation', () => {
    expect(parseCmes(CME_SAMPLE)).toEqual([
      { kind: 'cme', id: '2026-07-28T12:00:00-CME-001', time: '2026-07-28T12:00Z', classType: null, sourceLocation: 'N10W12' },
      { kind: 'cme', id: '2026-07-27T08:00:00-CME-002', time: '2026-07-27T08:00Z', classType: null, sourceLocation: null },
    ]);
  });

  it('returns an empty array for malformed input', () => {
    expect(parseCmes(null)).toEqual([]);
    expect(parseCmes('nope')).toEqual([]);
  });
});

describe('fetchCmeEvents', () => {
  it('fetches the CME feed', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/DONKI/CME')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(CME_SAMPLE) });
      }
      throw new Error(`unexpected url ${url}`);
    });
    const events = await fetchCmeEvents(fetchMock);
    expect(events.map((e) => e.id)).toEqual(['2026-07-28T12:00:00-CME-001', '2026-07-27T08:00:00-CME-002']);
  });

  it('throws when the request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve(null) });
    await expect(fetchCmeEvents(fetchMock)).rejects.toThrow();
  });
});
