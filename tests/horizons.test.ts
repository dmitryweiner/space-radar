import { coverageLimit, fetchSpacecraftTrack, horizonsUrl, parseHorizonsVectors } from '../src/api/horizons';

const RESULT = `*******************
$$SOE
2460966.500000000, A.D. 2025-Oct-18 00:00:00.0000, -3.174661440752892E+01, -1.340889084359229E+02,  9.701878922852920E+01,
2460967.500000000, A.D. 2025-Oct-19 00:00:00.0000, -3.174673000000000E+01, -1.340897000000000E+02,  9.701935000000000E+01,
$$EOE
*******************`;

const COVERAGE_ERROR =
  'No ephemeris for target "Hera (spacecraft)" after A.D. 2026-NOV-04 01:01:09.1826 TDB';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('horizons', () => {
  it('builds a Sun-centred ecliptic vectors query', () => {
    const url = horizonsUrl('-31', Date.UTC(2025, 9, 18), Date.UTC(2026, 10, 1), 2);
    expect(url).toContain("COMMAND='-31'");
    expect(url).toContain("CENTER='500@10'");
    expect(url).toContain("REF_PLANE='ECLIPTIC'");
    expect(url).toContain("START_TIME='2025-10-18'");
    expect(url).toContain("STEP_SIZE='2d'");
  });

  it('parses the CSV vector rows between $$SOE and $$EOE', () => {
    const samples = parseHorizonsVectors(RESULT);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ ms: Date.UTC(2025, 9, 18), xAu: -31.746614, yAu: -134.088908, zAu: 97.018789 });
    expect(parseHorizonsVectors('garbage')).toEqual([]);
  });

  it('reads the coverage edge out of a "No ephemeris" error', () => {
    expect(coverageLimit(COVERAGE_ERROR)).toEqual({ side: 'after', ms: Date.UTC(2026, 10, 4) });
    expect(coverageLimit('No ephemeris for target "X" prior to A.D. 2024-OCT-07 15:00 TDB')).toEqual({
      side: 'prior',
      ms: Date.UTC(2024, 9, 7),
    });
    expect(coverageLimit('Cannot interpret date')).toBeNull();
  });

  it('retries inside the coverage when the range runs past a mission end', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ result: COVERAGE_ERROR })) // via proxy
      .mockResolvedValueOnce(jsonResponse({ result: RESULT }));
    const track = await fetchSpacecraftTrack(
      { id: '-91', name: 'Hera', stepDays: 2 },
      Date.UTC(2025, 9, 18),
      Date.UTC(2026, 10, 30),
      fetchFn,
      async () => {},
    );
    expect(track.samples).toHaveLength(2);
    // Retried a day inside the edge (the proxy URL is percent-encoded).
    expect(decodeURIComponent(fetchFn.mock.calls[1][0])).toContain("STOP_TIME='2026-11-03'");
  });

  it('backs off and retries when Horizons is busy (503)', async () => {
    const busy = { ok: false, status: 503, json: async () => ({}) };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(busy) // proxy
      .mockResolvedValueOnce(busy) // direct fallback
      .mockResolvedValueOnce(jsonResponse({ result: RESULT }));
    const wait = vi.fn(async () => {});
    const track = await fetchSpacecraftTrack({ id: '-31', name: 'Voyager 1', stepDays: 4 }, 0, 1e10, fetchFn, wait);
    expect(track.samples).toHaveLength(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  it('throws when Horizons has nothing for the craft', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ result: 'Unknown target' }));
    await expect(fetchSpacecraftTrack({ id: '-1', name: 'Nope', stepDays: 1 }, 0, 1e10, fetchFn, async () => {})).rejects.toThrow(/Nope/);
  });
});
