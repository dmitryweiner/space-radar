import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

vi.mock('../src/render/earthScene', () => ({
  createEarthScene: vi.fn(() => ({
    setIssPosition: vi.fn(),
    setOrbitPath: vi.fn(),
    setSatellites: vi.fn(),
    setMarkers: vi.fn(),
    setFirePoints: vi.fn(),
    setLabelScale: vi.fn(),
    setEarthStyle: vi.fn(),
    setAutoRotateSpeed: vi.fn(),
    setOnMarkerClick: vi.fn(),
    setSatelliteTexture: vi.fn(),
    setSunPosition: vi.fn(),
  setViewDistance: vi.fn(),
    setAuroraPoints: vi.fn(),
    setVisible: vi.fn(),
    setTracks: vi.fn(),
    setNightLights: vi.fn(),
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
  createSolarSystemScene: vi.fn(() => ({
    setPlanetPositions: vi.fn(),
    setOrbitPaths: vi.fn(),
    setMoons: vi.fn(),
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

  it('opens on the Scene by default, with layers, status bar and inspector', async () => {
    render(<App />);
    expect(screen.getByTestId('scene-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scene' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ISS & satellites' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Active fires' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument();
  });

  it('toggles a layer and persists the choice', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Active fires' }));
    expect(screen.getByRole('checkbox', { name: 'Active fires' })).toBeChecked();
    const stored = JSON.parse(window.localStorage.getItem('space-radar:scene:v1') ?? '{}');
    expect(stored.enabledLayers).toContain('fires');
  });

  it('switches to the dashboard and remembers it', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.queryByTestId('scene-view')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('space-radar:ui-mode:v1') ?? 'null')).toBe('dashboard');
  });

  it('opens a detail panel from a status-bar chip', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /^Kp/ }));
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
    expect(document.querySelector('.inspector-title')?.textContent).toBe('Geomagnetic activity (Kp)');
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('button', { name: 'Close panel' })).not.toBeInTheDocument();
  });

  it('shows a full-screen overlay for a card, and exits it again', async () => {
    window.localStorage.setItem('space-radar:ui-mode:v1', '"dashboard"');
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Full screen Near-Earth Asteroids' }));
    expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit full screen for Near-Earth Asteroids' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Exit full screen for Near-Earth Asteroids' }));
    expect(screen.queryByTestId('fullscreen-overlay')).not.toBeInTheDocument();
  });

  it('exits full screen when Escape is pressed', async () => {
    window.localStorage.setItem('space-radar:ui-mode:v1', '"dashboard"');
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Full screen Near-Earth Asteroids' }));
    expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('fullscreen-overlay')).not.toBeInTheDocument();
  });
});
