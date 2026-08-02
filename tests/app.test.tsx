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

  it('shows a full-screen overlay for a card, and exits it again', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Full screen Near-Earth Asteroids' }));
    expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit full screen for Near-Earth Asteroids' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Exit full screen for Near-Earth Asteroids' }));
    expect(screen.queryByTestId('fullscreen-overlay')).not.toBeInTheDocument();
  });

  it('exits full screen when Escape is pressed', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Full screen Near-Earth Asteroids' }));
    expect(screen.getByTestId('fullscreen-overlay')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('fullscreen-overlay')).not.toBeInTheDocument();
  });
});
