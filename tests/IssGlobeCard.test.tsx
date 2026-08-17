import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssGlobeCard } from '../src/cards/IssGlobeCard';
import { fetchTleGroup } from '../src/api/celestrak';
import { createEarthScene } from '../src/render/earthScene';

vi.mock('../src/api/celestrak', () => ({
  fetchTleGroup: vi.fn(),
}));

const sceneHandle = {
  setIssPosition: vi.fn(),
  setOrbitPath: vi.fn(),
  setSatellites: vi.fn(),
  setMarkers: vi.fn(),
  setFirePoints: vi.fn(),
  setLabelScale: vi.fn(),
  setEarthStyle: vi.fn(),
  setAutoRotateSpeed: vi.fn(),
  setOnMarkerClick: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../src/render/earthScene', () => ({
  createEarthScene: vi.fn(() => sceneHandle),
  EARTH_RADIUS_UNITS: 2,
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

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchTleGroup).mockReset();
  vi.mocked(createEarthScene).mockClear();
  sceneHandle.setIssPosition.mockClear();
  sceneHandle.setOrbitPath.mockClear();
  sceneHandle.setSatellites.mockClear();
  sceneHandle.setOnMarkerClick.mockClear();
  sceneHandle.dispose.mockClear();
});

describe('IssGlobeCard', () => {
  it('shows a loading state before TLE data arrives', () => {
    vi.mocked(fetchTleGroup).mockReturnValue(new Promise(() => {}));
    render(<IssGlobeCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the TLE fetch fails', async () => {
    vi.mocked(fetchTleGroup).mockRejectedValue(new Error('CelesTrak unreachable'));
    render(<IssGlobeCard />);
    expect(await screen.findByText(/celestrak unreachable/i)).toBeInTheDocument();
  });

  it('mounts the Three.js scene and feeds it the ISS position and orbit path once data loads', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([
      { name: 'NOAA 15', line1: 'garbage', line2: 'garbage' },
      ISS_TLE,
    ]);
    render(<IssGlobeCard />);

    await vi.waitFor(() => expect(sceneHandle.setIssPosition).toHaveBeenCalled());
    expect(createEarthScene).toHaveBeenCalledOnce();
    const calls = sceneHandle.setIssPosition.mock.calls;
    const [positionArg] = calls[calls.length - 1];
    expect(positionArg).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }));
  });

  it('feeds every other satellite in the group to the scene, excluding the ISS itself', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE, POISK_TLE]);
    render(<IssGlobeCard />);

    await vi.waitFor(() => expect(sceneHandle.setSatellites).toHaveBeenCalled());
    const calls = sceneHandle.setSatellites.mock.calls;
    const [positions] = calls[calls.length - 1];
    expect(positions).toHaveLength(1);
  });

  it('still counts satellites when the ISS is not in the selected groups', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([{ name: 'NOAA 15', line1: 'a', line2: 'b' }]);
    render(<IssGlobeCard />);
    expect(await screen.findByText('1 satellite')).toBeInTheDocument();
  });

  it('disposes the scene on unmount', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE]);
    const { unmount } = render(<IssGlobeCard />);
    await vi.waitFor(() => expect(createEarthScene).toHaveBeenCalledOnce());
    unmount();
    expect(sceneHandle.dispose).toHaveBeenCalledOnce();
  });

  it('shows the ISS details popup (with an n2yo.com link) when the ISS marker is clicked', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE]);
    render(<IssGlobeCard />);
    await vi.waitFor(() => expect(sceneHandle.setOnMarkerClick).toHaveBeenCalled());

    const onMarkerClick = sceneHandle.setOnMarkerClick.mock.calls[0][0];
    onMarkerClick({ kind: 'iss' });

    expect(await screen.findByText('ISS (ZARYA)')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /details/i });
    expect(link).toHaveAttribute('href', 'https://www.n2yo.com/satellite/?s=25544');

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('ISS (ZARYA)')).not.toBeInTheDocument();
  });

  it('shows a satellite details popup when a satellite marker is clicked', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE, POISK_TLE]);
    render(<IssGlobeCard />);
    await vi.waitFor(() => expect(sceneHandle.setOnMarkerClick).toHaveBeenCalled());

    const onMarkerClick = sceneHandle.setOnMarkerClick.mock.calls[0][0];
    onMarkerClick({ kind: 'satellite', name: 'POISK' });

    expect(await screen.findByText('POISK')).toBeInTheDocument();
    expect(screen.getByText('35110')).toBeInTheDocument();
  });

  it('fetches each group once and reuses the cache when the selection grows', async () => {
    vi.mocked(fetchTleGroup).mockImplementation((group) =>
      Promise.resolve(group === 'stations' ? [ISS_TLE] : [POISK_TLE]),
    );
    const { rerender } = render(<IssGlobeCard settings={{ categories: ['stations'] }} />);
    await vi.waitFor(() => expect(fetchTleGroup).toHaveBeenCalledWith('stations'));

    rerender(<IssGlobeCard settings={{ categories: ['stations', 'visual'] }} />);
    await vi.waitFor(() => expect(fetchTleGroup).toHaveBeenCalledWith('visual'));

    const requested = vi.mocked(fetchTleGroup).mock.calls.map((call) => call[0]);
    // 'stations' was cached on the first render, so growing the selection only
    // fetches the newly-added 'visual' group.
    expect(requested.filter((group) => group === 'stations')).toHaveLength(1);
    expect(requested.filter((group) => group === 'visual')).toHaveLength(1);
  });
});
