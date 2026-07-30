import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

vi.mock('../src/render/earthScene', () => ({
  createEarthScene: vi.fn(() => ({ setIssPosition: vi.fn(), setOrbitPath: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
  EARTH_RADIUS_UNITS: 2,
}));

vi.mock('../src/render/solarSystemScene', () => ({
  createSolarSystemScene: vi.fn(() => ({ setPlanetPositions: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}));

describe('App', () => {
  it('renders the Space Radar brand', () => {
    render(<App />);
    expect(screen.getByText('Space Radar')).toBeInTheDocument();
  });
});
