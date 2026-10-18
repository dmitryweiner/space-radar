import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { App } from '../src/App';
import { createEarthScene } from '../src/render/earthScene';

vi.mock('../src/render/earthScene', () => ({
  createEarthScene: vi.fn(() => ({
    setLabelScale: vi.fn(),
    setEarthStyle: vi.fn(),
    setAutoRotateSpeed: vi.fn(),
    setOnMarkerClick: vi.fn(),
    setSatelliteTexture: vi.fn(),
    setSunPosition: vi.fn(),
    setViewDistance: vi.fn(),
    layer: vi.fn(() => ({
      setIssPosition: vi.fn(),
      setSatellites: vi.fn(),
      setMarkers: vi.fn(),
      setFirePoints: vi.fn(),
      setAuroraPoints: vi.fn(),
      setTracks: vi.fn(),
      setNightLights: vi.fn(),
      setVisible: vi.fn(),
    })),
    removeLayer: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  EARTH_RADIUS_UNITS: 2,
}));

vi.mock('../src/render/solarSystemScene', () => ({
  markerFocusKey: (layerId: string, id: string) => `${layerId}/${id}`,
  createSolarSystemScene: vi.fn(() => ({
    setPlanetPositions: vi.fn(),
    setOrbitPaths: vi.fn(),
    setMoons: vi.fn(),
    setOrientations: vi.fn(),
    focusBody: vi.fn(),
    setOnFocusChange: vi.fn(),
    layer: vi.fn(() => ({ setMarkers: vi.fn(), setTracks: vi.fn(), setVisible: vi.fn() })),
    removeLayer: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the Space Radar brand', () => {
    render(<App />);
    expect(screen.getByText('Space Radar')).toBeInTheDocument();
  });

  it('opens on the Scene, with layers, status bar and inspector', async () => {
    render(<App />);
    expect(screen.getByTestId('scene-view')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ISS & satellites' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Active fires' })).not.toBeChecked();
  });

  it('toggles a layer and persists the choice', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Active fires' }));
    expect(screen.getByRole('checkbox', { name: 'Active fires' })).toBeChecked();
    const stored = JSON.parse(window.localStorage.getItem('space-radar:scene:v1') ?? '{}');
    expect(stored.enabledLayers).toContain('fires');
  });


  it('shows the Solar System layers (on by default) and fly-to chips including spacecraft', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Solar System' }));
    for (const name of ['Spacecraft', 'Asteroid flybys', 'Comets']) {
      expect(screen.getByRole('checkbox', { name })).toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Voyager 1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Spacecraft' }));
    expect(screen.queryByRole('button', { name: 'Voyager 1' })).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('space-radar:scene:v1') ?? '{}');
    expect(stored.solarLayers).toEqual(['sol-asteroids', 'comets']);
  });

  it('opens a detail panel from a status-bar chip', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /^Kp/ }));
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
    expect(document.querySelector('.inspector-title')?.textContent).toBe('Geomagnetic activity (Kp)');
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('button', { name: 'Close panel' })).not.toBeInTheDocument();
  });

  it('shows a clicked globe marker\'s details in the inspector, with the layer it came from', async () => {
    const quakeFeed = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'q1',
          properties: { mag: 5.6, place: '20 km S of Testville', time: 1785733280034, url: 'https://usgs.test/q1' },
          geometry: { type: 'Point', coordinates: [140, -6, 33] },
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('usgs') ? { ok: true, status: 200, json: async () => quakeFeed } : Promise.reject(new Error('offline')),
      ),
    );
    render(<App />);
    await vi.waitFor(() => expect(vi.mocked(createEarthScene)).toHaveBeenCalled());
    const results = vi.mocked(createEarthScene).mock.results;
    const handle = results[results.length - 1].value;
    const clickCalls = vi.mocked(handle.setOnMarkerClick).mock.calls;
    const onClick = clickCalls[clickCalls.length - 1][0];
    // wait until the quakes layer has its data
    await screen.findByText('M4.5–6 (1)');
    await act(async () => {
      onClick?.({ kind: 'marker', id: 'q1' }, 'quakes');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(await screen.findByText('M5.6 — 20 km S of Testville')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Details/ })).toHaveAttribute('href', 'https://usgs.test/q1');
  });

});
