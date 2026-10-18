import { activeCometsUrl, famousCometsUrl, fetchComets, parseComets } from '../src/api/sbdb';

const SAMPLE = {
  signature: { source: 'NASA/JPL SBDB (Small-Body DataBase) Query API', version: '1.0' },
  fields: ['full_name', 'pdes', 'q', 'e', 'i', 'om', 'w', 'tp', 'M1'],
  data: [
    ['    1P/Halley', '1P', '0.575', '0.9679', '162.19', '59.10', '112.24', '2446469.97', '5.5'],
    ['     C/2024 J3 (ATLAS)', '2024 J3', '3.865', '1.0003', '75.64', '285.96', '74.09', '2461369.90', null],
    ['    broken', 'X', '', '0.5', '1', '2', '3', '4', '5'],
  ],
};

describe('sbdb comets', () => {
  it('parses rows by field name, trimming names and skipping incomplete rows', () => {
    const comets = parseComets(SAMPLE);
    expect(comets).toHaveLength(2);
    expect(comets[0]).toEqual({
      id: '1P',
      name: '1P/Halley',
      q: 0.575,
      e: 0.9679,
      i: 162.19,
      node: 59.1,
      peri: 112.24,
      tpJd: 2446469.97,
      magnitude: 5.5,
    });
    expect(comets[1].magnitude).toBeNull();
    expect(parseComets({ nope: true })).toEqual([]);
  });

  it('queries perihelia within a day-rounded window, brightest first', () => {
    const url = new URL(activeCometsUrl(new Date(Date.UTC(2026, 9, 18, 15)), 365, 4, 10));
    expect(url.searchParams.get('sort')).toBe('M1');
    expect(url.searchParams.get('sb-kind')).toBe('c');
    expect(JSON.parse(url.searchParams.get('sb-cdata') ?? '{}')).toEqual({
      AND: ['tp|RG|2460966.5|2461696.5', 'q|LT|4'],
    });
    expect(JSON.parse(new URL(famousCometsUrl()).searchParams.get('sb-cdata') ?? '{}').OR).toContain('pdes|EQ|1P');
  });

  it('fetches through the proxy first', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => SAMPLE });
    const comets = await fetchComets(famousCometsUrl(), fetchFn);
    expect(comets).toHaveLength(2);
    expect(fetchFn.mock.calls[0][0]).toMatch(/^https:\/\/space-radar-proxy[^/]+\/jpl\/sbdb_query\.api\?/);
  });
});
