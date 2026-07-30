import { render, screen } from '@testing-library/react';
import { KpIndexCard } from '../src/cards/KpIndexCard';
import { fetchKpIndex } from '../src/api/swpc';

vi.mock('../src/api/swpc', () => ({
  fetchKpIndex: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchKpIndex).mockReset();
});

describe('KpIndexCard', () => {
  it('shows a loading state before data arrives', () => {
    vi.mocked(fetchKpIndex).mockReturnValue(new Promise(() => {}));
    render(<KpIndexCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(fetchKpIndex).mockRejectedValue(new Error('network down'));
    render(<KpIndexCard />);
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });

  it('renders one bar per point, the current status, and the latest reading time', async () => {
    vi.mocked(fetchKpIndex).mockResolvedValue([
      { time: '2026-07-29T00:00:00', kp: 2 },
      { time: '2026-07-29T03:00:00', kp: 7.67 },
    ]);
    render(<KpIndexCard />);
    const bars = await screen.findAllByTestId('kp-bar');
    expect(bars).toHaveLength(2);
    expect(screen.getByText('Severe storm')).toBeInTheDocument();
    expect(screen.getByText(/2026-07-29 03:00 UTC/)).toBeInTheDocument();
  });
});
