import { render, screen } from '@testing-library/react';
import { SolarWindCard } from '../src/cards/SolarWindCard';
import { fetchSolarWind } from '../src/api/swpc';

vi.mock('../src/api/swpc', () => ({
  fetchSolarWind: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchSolarWind).mockReset();
});

describe('SolarWindCard', () => {
  it('shows a loading state before data arrives', () => {
    vi.mocked(fetchSolarWind).mockReturnValue(new Promise(() => {}));
    render(<SolarWindCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(fetchSolarWind).mockRejectedValue(new Error('service unavailable'));
    render(<SolarWindCard />);
    expect(await screen.findByText(/service unavailable/i)).toBeInTheDocument();
  });

  it('renders a speed chart and a density chart, plus the latest readings and their time', async () => {
    vi.mocked(fetchSolarWind).mockResolvedValue([
      { time: '2026-07-29T00:00:00Z', density: 4.5, speed: 400, temperature: 100000 },
      { time: '2026-07-29T00:05:00Z', density: null, speed: 410, temperature: 101000 },
    ]);
    render(<SolarWindCard />);
    await screen.findByText(/410/);
    expect(screen.getByTestId('solar-wind-speed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('solar-wind-density-chart')).toBeInTheDocument();
    expect(screen.getByText(/2026-07-29 00:05 UTC/)).toBeInTheDocument();
  });
});
