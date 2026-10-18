import { renderHook } from '@testing-library/react';
import { issLayer } from '../src/layers/issLayer';
import { fetchTleGroup } from '../src/api/celestrak';
import type { CardSettingValues } from '../src/settings/types';

vi.mock('../src/api/celestrak', () => ({
  fetchTleGroup: vi.fn(),
}));

const ISS_TLE = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   26210.89416807  .00008676  00000+0  16394-3 0  9996',
  line2: '2 25544  51.6319  88.7482 0007060 351.9810   8.1065 15.49254247578377',
};

const POISK_TLE = {
  name: 'POISK',
  line1: '1 35110U 98067AN  26210.89416807  .00008676  00000+0  16394-3 0  9990',
  line2: '2 35110  51.6319  88.7482 0007060 351.9810   8.1065 15.49254247578377',
};

function renderLayer(settings: CardSettingValues = {}) {
  return renderHook(({ values }) => issLayer.useLayer(values, null), { initialProps: { values: settings } });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchTleGroup).mockReset();
});

describe('issLayer', () => {
  it('is loading with an empty frame before TLE data arrives', () => {
    vi.mocked(fetchTleGroup).mockReturnValue(new Promise(() => {}));
    const { result } = renderLayer();
    expect(result.current.loading).toBe(true);
    expect(result.current.frame).toEqual({});
  });

  it('reports the TLE fetch error', async () => {
    vi.mocked(fetchTleGroup).mockRejectedValue(new Error('CelesTrak unreachable'));
    const { result } = renderLayer();
    await vi.waitFor(() => expect(result.current.error).toMatch(/celestrak unreachable/i));
  });

  it('puts the ISS in the frame and every other satellite in `satellites`', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE, POISK_TLE]);
    const { result } = renderLayer();
    await vi.waitFor(() => expect(result.current.frame.iss).toBeTruthy());
    expect(result.current.frame.iss?.position).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }),
    );
    expect(result.current.frame.satellites).toHaveLength(1);
    expect(result.current.summary).toBe('2 satellites');
  });

  it('still counts satellites when the ISS is not in the selected groups', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([{ name: 'NOAA 15', line1: 'a', line2: 'b' }]);
    const { result } = renderLayer();
    await vi.waitFor(() => expect(result.current.summary).toBe('1 satellite'));
    expect(result.current.frame.iss).toBeNull();
  });

  it('describes the ISS and satellite markers (with an n2yo.com link)', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE, POISK_TLE]);
    const { result } = renderLayer();
    await vi.waitFor(() => expect(result.current.frame.iss).toBeTruthy());

    expect(result.current.describe({ kind: 'iss' })).toEqual(
      expect.objectContaining({ title: 'ISS (ZARYA)', detailUrl: 'https://www.n2yo.com/satellite/?s=25544' }),
    );
    expect(result.current.describe({ kind: 'satellite', name: 'POISK' })?.fields).toEqual([
      { label: 'NORAD ID', value: '35110' },
    ]);
    expect(result.current.describe({ kind: 'marker', id: 'nope' })).toBeNull();
  });

  it('fetches each group once and reuses the cache when the selection grows', async () => {
    vi.mocked(fetchTleGroup).mockImplementation((group) =>
      Promise.resolve(group === 'stations' ? [ISS_TLE] : [POISK_TLE]),
    );
    const { rerender } = renderLayer({ categories: ['stations'] });
    await vi.waitFor(() => expect(fetchTleGroup).toHaveBeenCalledWith('stations'));

    rerender({ values: { categories: ['stations', 'visual'] } });
    await vi.waitFor(() => expect(fetchTleGroup).toHaveBeenCalledWith('visual'));

    const requested = vi.mocked(fetchTleGroup).mock.calls.map((call) => call[0]);
    // 'stations' was cached on the first render, so growing the selection only
    // fetches the newly-added 'visual' group.
    expect(requested.filter((group) => group === 'stations')).toHaveLength(1);
    expect(requested.filter((group) => group === 'visual')).toHaveLength(1);
  });
});
