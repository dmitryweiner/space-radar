import { renderHook } from '@testing-library/react';
import { quakesLayer } from '../src/layers/quakesLayer';
import { fetchQuakes } from '../src/api/usgsQuakes';

vi.mock('../src/api/usgsQuakes', async () => {
  const actual = await vi.importActual<typeof import('../src/api/usgsQuakes')>('../src/api/usgsQuakes');
  return { ...actual, fetchQuakes: vi.fn() };
});

const SAMPLE = [
  {
    id: 'quake-1',
    magnitude: 5.2,
    place: '10km N of Somewhere',
    time: Date.UTC(2026, 6, 30, 12, 0),
    latitude: 10,
    longitude: 20,
    depthKm: 12.3,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/quake-1',
  },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchQuakes).mockReset();
});

describe('quakesLayer', () => {
  it('describes a clicked quake marker (with a USGS link) and ignores unknown ids', async () => {
    vi.mocked(fetchQuakes).mockResolvedValue(SAMPLE);
    const { result } = renderHook(() => quakesLayer.useLayer({}, null));
    await vi.waitFor(() => expect(result.current.frame.markers).toHaveLength(1));

    const details = result.current.describe({ kind: 'marker', id: 'quake-1' });
    expect(details?.title).toBe('M5.2 — 10km N of Somewhere');
    expect(details?.detailUrl).toBe('https://earthquake.usgs.gov/earthquakes/eventpage/quake-1');
    expect(result.current.describe({ kind: 'marker', id: 'does-not-exist' })).toBeNull();
  });
});
