import { render, screen } from '@testing-library/react';
import { SolarFlaresCard } from '../src/cards/SolarFlaresCard';
import { fetchCmeEvents } from '../src/api/donki';
import { fetchGoesFlares } from '../src/api/swpc';

vi.mock('../src/api/donki', () => ({
  fetchCmeEvents: vi.fn(),
}));

vi.mock('../src/api/swpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/swpc')>();
  return { ...actual, fetchGoesFlares: vi.fn() };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchCmeEvents).mockReset();
  vi.mocked(fetchGoesFlares).mockReset();
  vi.mocked(fetchCmeEvents).mockResolvedValue([]);
});

describe('SolarFlaresCard', () => {
  it('shows a loading state before data arrives', () => {
    vi.mocked(fetchGoesFlares).mockReturnValue(new Promise(() => {}));
    render(<SolarFlaresCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the flare fetch fails', async () => {
    vi.mocked(fetchGoesFlares).mockRejectedValue(new Error('SWPC unreachable'));
    render(<SolarFlaresCard />);
    expect(await screen.findByText(/swpc unreachable/i)).toBeInTheDocument();
  });

  it('shows a message when there are no recent events', async () => {
    vi.mocked(fetchGoesFlares).mockResolvedValue([]);
    render(<SolarFlaresCard />);
    expect(await screen.findByText(/no recent/i)).toBeInTheDocument();
  });

  it('lists flares and CMEs with a kind badge and source location', async () => {
    vi.mocked(fetchGoesFlares).mockResolvedValue([
      { kind: 'flare', id: 'f1', time: '2026-07-28T10:12Z', classType: 'M1.2', sourceLocation: 'N15W20' },
    ]);
    vi.mocked(fetchCmeEvents).mockResolvedValue([
      { kind: 'cme', id: 'c1', time: '2026-07-27T08:00Z', classType: null, sourceLocation: null },
    ]);
    render(<SolarFlaresCard />);
    expect(await screen.findByText('M1.2')).toBeInTheDocument();
    expect(screen.getByText('N15W20')).toBeInTheDocument();
    expect(screen.getByText('CME')).toBeInTheDocument();
  });

  it('still lists flares when the DONKI CME feed fails', async () => {
    vi.mocked(fetchGoesFlares).mockResolvedValue([
      { kind: 'flare', id: 'f1', time: '2026-07-28T10:12Z', classType: 'C3.9', sourceLocation: null },
    ]);
    vi.mocked(fetchCmeEvents).mockRejectedValue(new Error('DONKI 503'));
    render(<SolarFlaresCard />);
    expect(await screen.findByText('C3.9')).toBeInTheDocument();
    expect(screen.queryByText(/donki 503/i)).not.toBeInTheDocument();
  });
});
