import { parseNoaaScales } from '../src/api/swpc';
import { parsePeopleInSpace } from '../src/api/launchLibrary';

describe('parseNoaaScales', () => {
  // Trimmed from the live products/noaa-scales.json (2026-10-14).
  const LIVE = {
    '0': {
      DateStamp: '2026-10-14',
      TimeStamp: '08:13:00',
      R: { Scale: '0', Text: 'none', MinorProb: null, MajorProb: null },
      S: { Scale: '1', Text: 'minor', Prob: null },
      G: { Scale: '2', Text: 'moderate' },
    },
    '1': { R: { Scale: null }, S: { Scale: null }, G: { Scale: '0' } },
  };

  it('reads the current R/S/G levels', () => {
    expect(parseNoaaScales(LIVE)).toEqual({ r: 0, s: 1, g: 2, observedAt: '2026-10-14 08:13:00' });
  });

  it('rejects unexpected shapes', () => {
    expect(parseNoaaScales(null)).toBeNull();
    expect(parseNoaaScales({ '0': { R: {}, S: {}, G: {} } })).toBeNull();
  });
});

describe('parsePeopleInSpace', () => {
  it('reads the total count and names with agencies', () => {
    const raw = {
      count: 2,
      results: [
        { id: 1, name: 'Ann Example', agency: { name: 'NASA', abbrev: 'NASA' } },
        { id: 2, name: 'Li Example' },
        { id: 3 },
      ],
    };
    expect(parsePeopleInSpace(raw)).toEqual({
      count: 2,
      people: [
        { name: 'Ann Example', agency: 'NASA' },
        { name: 'Li Example', agency: null },
      ],
    });
  });

  it('rejects non-list responses (e.g. a throttle message)', () => {
    expect(parsePeopleInSpace({ detail: 'Request was throttled.' })).toBeNull();
  });
});
