import { render, screen } from '@testing-library/react';
import { IssGlobeCard } from '../src/cards/IssGlobeCard';
import { fetchTleGroup } from '../src/api/celestrak';
import { createEarthScene } from '../src/render/earthScene';

vi.mock('../src/api/celestrak', () => ({
  fetchTleGroup: vi.fn(),
}));

const sceneHandle = {
  setIssPosition: vi.fn(),
  setOrbitPath: vi.fn(),
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

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchTleGroup).mockReset();
  vi.mocked(createEarthScene).mockClear();
  sceneHandle.setIssPosition.mockClear();
  sceneHandle.setOrbitPath.mockClear();
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
    expect(sceneHandle.setOrbitPath).toHaveBeenCalled();
    const calls = sceneHandle.setIssPosition.mock.calls;
    const [positionArg] = calls[calls.length - 1];
    expect(positionArg).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }));
  });

  it('shows a message when the ISS cannot be found in the fetched group', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([{ name: 'NOAA 15', line1: 'a', line2: 'b' }]);
    render(<IssGlobeCard />);
    expect(await screen.findByText(/iss.*not found/i)).toBeInTheDocument();
  });

  it('disposes the scene on unmount', async () => {
    vi.mocked(fetchTleGroup).mockResolvedValue([ISS_TLE]);
    const { unmount } = render(<IssGlobeCard />);
    await vi.waitFor(() => expect(createEarthScene).toHaveBeenCalledOnce());
    unmount();
    expect(sceneHandle.dispose).toHaveBeenCalledOnce();
  });
});
