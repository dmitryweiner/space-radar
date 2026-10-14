import { fetchGibsSnapshot, gibsDate, gibsSnapshotUrl } from '../src/api/gibs';

const NOW = new Date('2026-10-14T07:00:00Z');

function blobOf(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

describe('gibs', () => {
  it('builds a lat,lon-ordered WMS 1.3.0 GetMap URL for a date', () => {
    const url = gibsSnapshotUrl('2026-10-12');
    expect(url).toContain('BBOX=-90%2C-180%2C90%2C180');
    expect(url).toContain('TIME=2026-10-12');
    expect(url).toContain('WIDTH=2048');
    expect(url).toContain('HEIGHT=1024');
  });

  it('starts at today−2', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, blob: async () => blobOf(300 * 1024) }));
    const snapshot = await fetchGibsSnapshot(fetchFn, NOW);
    expect(snapshot?.date).toBe('2026-10-12');
    expect(gibsDate(NOW, 2)).toBe('2026-10-12');
  });

  it('steps back past errors and partial (small) days', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('2026-10-12')) return { ok: false, blob: async () => blobOf(0) };
      if (url.includes('2026-10-11')) return { ok: true, blob: async () => blobOf(20 * 1024) };
      return { ok: true, blob: async () => blobOf(320 * 1024) };
    });
    expect((await fetchGibsSnapshot(fetchFn, NOW))?.date).toBe('2026-10-10');
  });

  it('gives up with null when nothing recent is complete', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('offline');
    });
    expect(await fetchGibsSnapshot(fetchFn, NOW)).toBeNull();
  });
});
