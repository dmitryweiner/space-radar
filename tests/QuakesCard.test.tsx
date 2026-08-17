import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuakesCard } from '../src/cards/QuakesCard';
import { fetchQuakes } from '../src/api/usgsQuakes';
import { createEarthScene } from '../src/render/earthScene';

vi.mock('../src/api/usgsQuakes', async () => {
  const actual = await vi.importActual<typeof import('../src/api/usgsQuakes')>('../src/api/usgsQuakes');
  return { ...actual, fetchQuakes: vi.fn() };
});

const sceneHandle = {
  setIssPosition: vi.fn(),
  setSatellites: vi.fn(),
  setMarkers: vi.fn(),
  setFirePoints: vi.fn(),
  setAuroraPoints: vi.fn(),
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
  vi.mocked(createEarthScene).mockClear();
  sceneHandle.setOnMarkerClick.mockClear();
});

describe('QuakesCard', () => {
  it('shows a quake details popup (with a USGS link) when its marker is clicked', async () => {
    vi.mocked(fetchQuakes).mockResolvedValue(SAMPLE);
    render(<QuakesCard />);
    await vi.waitFor(() => expect(sceneHandle.setOnMarkerClick).toHaveBeenCalled());

    const onMarkerClick = sceneHandle.setOnMarkerClick.mock.calls[0][0];
    onMarkerClick({ kind: 'marker', id: 'quake-1' });

    expect(await screen.findByText('M5.2 — 10km N of Somewhere')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /details/i });
    expect(link).toHaveAttribute('href', 'https://earthquake.usgs.gov/earthquakes/eventpage/quake-1');

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('M5.2 — 10km N of Somewhere')).not.toBeInTheDocument();
  });

  it('ignores clicks on unknown marker ids', async () => {
    vi.mocked(fetchQuakes).mockResolvedValue(SAMPLE);
    render(<QuakesCard />);
    await vi.waitFor(() => expect(sceneHandle.setOnMarkerClick).toHaveBeenCalled());

    const onMarkerClick = sceneHandle.setOnMarkerClick.mock.calls[0][0];
    onMarkerClick({ kind: 'marker', id: 'does-not-exist' });

    expect(screen.queryByTestId('marker-info-popup')).not.toBeInTheDocument();
  });
});
