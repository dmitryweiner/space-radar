import { render, screen } from '@testing-library/react';
import { SolarFlaresCard } from '../src/cards/SolarFlaresCard';
import { fetchSpaceWeatherEvents } from '../src/api/donki';

vi.mock('../src/api/donki', () => ({
  fetchSpaceWeatherEvents: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchSpaceWeatherEvents).mockReset();
});

describe('SolarFlaresCard', () => {
  it('shows a loading state before data arrives', () => {
    vi.mocked(fetchSpaceWeatherEvents).mockReturnValue(new Promise(() => {}));
    render(<SolarFlaresCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(fetchSpaceWeatherEvents).mockRejectedValue(new Error('DONKI unreachable'));
    render(<SolarFlaresCard />);
    expect(await screen.findByText(/donki unreachable/i)).toBeInTheDocument();
  });

  it('shows a message when there are no recent events', async () => {
    vi.mocked(fetchSpaceWeatherEvents).mockResolvedValue([]);
    render(<SolarFlaresCard />);
    expect(await screen.findByText(/no recent/i)).toBeInTheDocument();
  });

  it('lists flares and CMEs with a kind badge and source location', async () => {
    vi.mocked(fetchSpaceWeatherEvents).mockResolvedValue([
      { kind: 'flare', id: 'f1', time: '2026-07-28T10:12Z', classType: 'M1.2', sourceLocation: 'N15W20' },
      { kind: 'cme', id: 'c1', time: '2026-07-27T08:00Z', classType: null, sourceLocation: null },
    ]);
    render(<SolarFlaresCard />);
    expect(await screen.findByText('M1.2')).toBeInTheDocument();
    expect(screen.getByText('N15W20')).toBeInTheDocument();
    expect(screen.getByText('CME')).toBeInTheDocument();
  });
});
